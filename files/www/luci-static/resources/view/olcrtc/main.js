'use strict';
'require view';
'require uci';
'require rpc';
'require ui';

/*
 * OlcRTC-OpenWRT — LuCI-панель управления
 * Основана на проекте OlcRTC (https://github.com/openlibrecommunity/olcrtc)
 * автора zarazaex / openlibrecommunity
 *
 * Сохранение: автоматическое при изменении любого поля (ubus uci/set + uci/commit).
 * НЕ используем uci.apply() — он предназначен для сетевых настроек и вызывает
 * ошибку "ubus code 5: No data received" при использовании не по назначению.
 */

/* ══════════════════════════════════════════════════════════
   RPC-объявления (прямые ubus-вызовы, без LuCI-прослойки)
   ══════════════════════════════════════════════════════════ */

var callInitAction = rpc.declare({
    object : 'rc',
    method : 'init',
    params : [ 'name', 'action' ],
    expect : { result: 0 }
});

var callServiceList = rpc.declare({
    object : 'service',
    method : 'list',
    params : [ 'name' ],
    expect : { '': {} }
});

var callUciSet = rpc.declare({
    object : 'uci',
    method : 'set',
    params : [ 'config', 'section', 'values' ],
    expect : {}
});

var callUciCommit = rpc.declare({
    object : 'uci',
    method : 'commit',
    params : [ 'config' ],
    expect : {}
});

var callExec = rpc.declare({
    object : 'file',
    method : 'exec',
    params : [ 'command', 'params', 'env' ],
    expect : { stdout: '' }
});

/* ══════════════════════════════════════════════════════════
   Матрица совместимости carrier ↔ transport
   ══════════════════════════════════════════════════════════ */

var COMPAT = {
    telemost : ['vp8channel', 'videochannel'],
    jazz     : ['datachannel', 'vp8channel', 'seichannel', 'videochannel'],
    wbstream : ['datachannel', 'vp8channel', 'seichannel', 'videochannel']
};

/* ══════════════════════════════════════════════════════════
   Вспомогательные функции
   ══════════════════════════════════════════════════════════ */

function getStatus() {
    return callServiceList('olcrtc').then(function (res) {
        var instances = (res && res.olcrtc && res.olcrtc.instances)
                        ? res.olcrtc.instances : {};
        var running = false;
        var pid     = null;

        Object.keys(instances).forEach(function (k) {
            if (instances[k].running) {
                running = true;
                pid     = instances[k].pid || null;
            }
        });

        return { running: running, pid: pid };
    }).catch(function () {
        return { running: false, pid: null };
    });
}

function getLogs() {
    return callExec('/sbin/logread', [ '-e', 'olcrtc' ], null)
        .then(function (res) {
            return (res && res.length > 0) ? res : '(записей в логе пока нет)';
        })
        .catch(function () {
            return callExec('/sbin/logread', [], null)
                .then(function (res) {
                    if (!res) return '(лог пуст)';
                    var lines = res.split('\n').filter(function (l) {
                        return l.toLowerCase().indexOf('olcrtc') !== -1;
                    });
                    return lines.length ? lines.join('\n') : '(записей с тегом olcrtc нет)';
                })
                .catch(function () {
                    return '(logread недоступен — проверьте ACL в /usr/share/rpcd/acl.d/)';
                });
        });
}

/* ══════════════════════════════════════════════════════════
   Основной вид
   ══════════════════════════════════════════════════════════ */
return view.extend({

    _statusTimer  : null,   /* опрос статуса каждые 300 мс */
    _logsTimer    : null,   /* опрос логов каждые 3000 мс  */
    _statusEl     : null,
    _logsEl       : null,
    _startBtn     : null,
    _stopBtn      : null,
    _transportSel : null,

    load: function () {
        return Promise.all([
            uci.load('olcrtc'),
            getStatus()
        ]);
    },

    _saveField: function (key, value) {
        var values = {};
        values[key] = value;
        callUciSet('olcrtc', 'config', values)
            .then(function () { return callUciCommit('olcrtc'); })
            .catch(function (e) {
                console.error('[OlcRTC] Ошибка сохранения UCI:', e);
            });
    },

    _updateUI: function (status) {
        if (this._statusEl) {
            var dot   = status.running ? '🟢' : '🔴';
            var label = status.running
                ? ('Работает' + (status.pid ? ' (PID ' + status.pid + ')' : ''))
                : 'Остановлен';
            this._statusEl.innerHTML = dot + ' <strong>' + label + '</strong>';
        }

        if (this._startBtn) {
            this._startBtn.disabled      = !!status.running;
            this._startBtn.style.opacity = status.running ? '0.5' : '1';
        }
        if (this._stopBtn) {
            this._stopBtn.disabled       = !status.running;
            this._stopBtn.style.opacity  = !status.running ? '0.5' : '1';
        }
    },

    _startPolling: function () {
        var self = this;

        /* Статус — быстрый, лёгкий вызов, обновляем каждые 300 мс */
        if (self._statusTimer) clearInterval(self._statusTimer);
        self._statusTimer = setInterval(function () {
            getStatus().then(function (s) { self._updateUI(s); });
        }, 300);

        /* Логи — тяжелее, обновляем каждые 3 секунды */
        if (self._logsTimer) clearInterval(self._logsTimer);
        self._logsTimer = setInterval(function () {
            getLogs().then(function (text) {
                if (!self._logsEl) return;
                var el       = self._logsEl;
                var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                el.textContent = text;
                if (atBottom) el.scrollTop = el.scrollHeight;
            });
        }, 3000);
    },

    /* Обновляет список транспортов в зависимости от выбранного carrier.
       Если текущий транспорт несовместим — переключает на vp8channel. */
    _updateTransportOptions: function (carrier) {
        var self    = this;
        var sel     = self._transportSel;
        if (!sel) return;

        var allowed = COMPAT[carrier] || COMPAT['telemost'];
        var opts    = sel.options;

        for (var i = 0; i < opts.length; i++) {
            opts[i].disabled = allowed.indexOf(opts[i].value) === -1;
        }

        if (allowed.indexOf(sel.value) === -1) {
            sel.value = 'vp8channel';
            self._saveField('transport', 'vp8channel');
        }
    },

    render: function (data) {
        var self       = this;
        var initStatus = data[1];

        var cfg = {
            carrier    : uci.get('olcrtc', 'config', 'carrier')    || 'telemost',
            transport  : uci.get('olcrtc', 'config', 'transport')  || 'vp8channel',
            room_id    : uci.get('olcrtc', 'config', 'room_id')    || '',
            client_id  : uci.get('olcrtc', 'config', 'client_id')  || '',
            key        : uci.get('olcrtc', 'config', 'key')        || '',
            socks_port : uci.get('olcrtc', 'config', 'socks_port') || '1080',
            dns        : uci.get('olcrtc', 'config', 'dns')        || '1.1.1.1:53'
        };

        /* ── Блок статуса ───────────────────────────────────── */
        var statusSpan = E('span');
        self._statusEl = statusSpan;

        var startBtn = E('button', {
            class : 'btn cbi-button cbi-button-apply',
            style : 'margin-right:8px',
            click : ui.createHandlerFn(self, function () {
                /* Моментально блокируем кнопки, не дожидаясь следующего тика */
                startBtn.disabled      = true;
                startBtn.style.opacity = '0.5';
                stopBtn.disabled       = true;
                stopBtn.style.opacity  = '0.5';

                return callInitAction('olcrtc', 'start')
                    .then(function () {
                        ui.addNotification(null, E('p', 'OlcRTC запущен'), 'info');
                    })
                    .catch(function (e) {
                        ui.addNotification(null,
                            E('p', 'Ошибка запуска: ' + (e.message || e)), 'error');
                    })
                    .then(function () {
                        /* Принудительный немедленный опрос после действия */
                        return getStatus().then(function (s) { self._updateUI(s); });
                    });
            })
        }, '▶ Старт');

        var stopBtn = E('button', {
            class : 'btn cbi-button cbi-button-reset',
            click : ui.createHandlerFn(self, function () {
                /* Моментально блокируем кнопки */
                startBtn.disabled      = true;
                startBtn.style.opacity = '0.5';
                stopBtn.disabled       = true;
                stopBtn.style.opacity  = '0.5';

                return callInitAction('olcrtc', 'stop')
                    .then(function () {
                        ui.addNotification(null, E('p', 'OlcRTC остановлен'), 'info');
                    })
                    .catch(function (e) {
                        ui.addNotification(null,
                            E('p', 'Ошибка остановки: ' + (e.message || e)), 'error');
                    })
                    .then(function () {
                        /* Принудительный немедленный опрос после действия */
                        return getStatus().then(function (s) { self._updateUI(s); });
                    });
            })
        }, '■ Стоп');

        self._startBtn = startBtn;
        self._stopBtn  = stopBtn;
        self._updateUI(initStatus);

        var statusSection = E('div', { class: 'cbi-section' }, [
            E('legend', {}, 'Статус'),
            E('div', { class: 'cbi-section-node' }, [
                E('div', { style: 'margin-bottom:14px;font-size:1.15em;line-height:1.8;' },
                    statusSpan),
                E('div', {}, [ startBtn, stopBtn ])
            ])
        ]);

        /* ── Вспомогательная функция строки формы ───────────── */
        function row(label, hint, inputEl) {
            return E('div', { class: 'cbi-value' }, [
                E('label', { class: 'cbi-value-title' }, label),
                E('div', { class: 'cbi-value-field' }, [
                    inputEl,
                    hint ? E('div', {
                        class : 'cbi-value-description',
                        style : 'margin-top:4px;font-size:0.85em;'
                    }, hint) : null
                ].filter(Boolean))
            ]);
        }

        /* Дебаунс 600 мс для текстовых полей */
        function makeDebounced(fieldName) {
            var timer;
            return {
                change : function (ev) {
                    clearTimeout(timer);
                    self._saveField(fieldName, ev.target.value.trim());
                },
                input : function (ev) {
                    var v = ev.target.value;
                    clearTimeout(timer);
                    timer = setTimeout(function () {
                        self._saveField(fieldName, v.trim());
                    }, 600);
                }
            };
        }

        /* ── Carrier ─────────────────────────────────────────── */
        var carrierSel = E('select', {
            class  : 'cbi-input-select',
            change : function (ev) {
                var c = ev.target.value;
                self._saveField('carrier', c);
                self._updateTransportOptions(c);
            }
        }, [
            E('option', { value: 'telemost',
                          selected: cfg.carrier === 'telemost' ? '' : null },
                'Telemost (telemost.yandex.ru)'),
            E('option', { value: 'jazz',
                          selected: cfg.carrier === 'jazz' ? '' : null },
                'Jazz (salutejazz.ru)'),
            E('option', { value: 'wbstream',
                          selected: cfg.carrier === 'wbstream' ? '' : null },
                'Wildberries Stream (stream.wb.ru)')
        ]);

        /* ── Transport ───────────────────────────────────────── */
        var allowed = COMPAT[cfg.carrier] || COMPAT['telemost'];

        var transportSel = E('select', {
            class  : 'cbi-input-select',
            change : function (ev) {
                self._saveField('transport', ev.target.value);
            }
        }, [
            E('option', {
                value    : 'datachannel',
                selected : cfg.transport === 'datachannel' ? '' : null,
                disabled : allowed.indexOf('datachannel') === -1 ? '' : null
            }, 'datachannel — максимальная скорость (не для Telemost)'),
            E('option', {
                value    : 'vp8channel',
                selected : cfg.transport === 'vp8channel' ? '' : null
            }, 'vp8channel — работает везде (рекомендуется)'),
            E('option', {
                value    : 'seichannel',
                selected : cfg.transport === 'seichannel' ? '' : null,
                disabled : allowed.indexOf('seichannel') === -1 ? '' : null
            }, 'seichannel — не для Telemost'),
            E('option', {
                value    : 'videochannel',
                selected : cfg.transport === 'videochannel' ? '' : null
            }, 'videochannel — крайний случай, везде')
        ]);

        self._transportSel = transportSel;

        /* ── Room ID ─────────────────────────────────────────── */
        var roomHandlers = makeDebounced('room_id');
        var roomInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'text',
            value       : cfg.room_id,
            placeholder : 'Например: 49286587700808',
            change      : roomHandlers.change,
            input       : roomHandlers.input
        });

        /* ── Client ID ───────────────────────────────────────── */
        var clientHandlers = makeDebounced('client_id');
        var clientInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'text',
            value       : cfg.client_id,
            placeholder : 'Например: home-router',
            change      : clientHandlers.change,
            input       : clientHandlers.input
        });

        /* ── Key ─────────────────────────────────────────────── */
        var keyHandlers = makeDebounced('key');
        var keyInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'password',
            value       : cfg.key,
            placeholder : 'e5265a924657a8807dc...',
            change      : keyHandlers.change,
            input       : keyHandlers.input
        });

        /* ── SOCKS5 порт ─────────────────────────────────────── */
        var portInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'number',
            value       : cfg.socks_port,
            placeholder : '1080',
            min         : '1',
            max         : '65535',
            change : function (ev) {
                var v = parseInt(ev.target.value);
                if (v >= 1 && v <= 65535)
                    self._saveField('socks_port', String(v));
            }
        });

        /* ── DNS ─────────────────────────────────────────────── */
        var dnsHandlers = makeDebounced('dns');
        var dnsInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'text',
            value       : cfg.dns,
            placeholder : '1.1.1.1:53',
            change      : dnsHandlers.change,
            input       : dnsHandlers.input
        });

        var settingsSection = E('div', { class: 'cbi-section' }, [
            E('legend', {}, 'Настройки подключения'),
            E('div', { class: 'cbi-section-node' }, [
                row('Сервис',
                    'Через какой сервис идёт туннель. Telemost поддерживает меньше транспортов.',
                    carrierSel),
                row('Транспорт',
                    'Протокол передачи данных внутри туннеля.',
                    transportSel),
                row('Room ID',
                    'ID комнаты с сервера. Скопируйте из вывода сервера при его первом запуске.',
                    roomInput),
                row('Client ID',
                    'Короткий идентификатор, должен совпадать с сервером (например: home-router).',
                    clientInput),
                row('Ключ шифрования',
                    'HEX-строка 64 символа. Генерация: openssl rand -hex 32. Должна совпадать с сервером.',
                    keyInput),
                row('SOCKS5-порт',
                    'Локальный порт прокси (по умолчанию 1080).',
                    portInput),
                row('DNS-сервер',
                    'DNS для резолвинга в туннеле (по умолчанию 1.1.1.1:53).',
                    dnsInput)
            ])
        ]);

        /* ── Блок логов ──────────────────────────────────────── */
        var logsEl = E('pre', {
            style : 'background:#0d1117;color:#3fb950;padding:12px;' +
                    'max-height:360px;overflow-y:auto;border-radius:6px;' +
                    'font-size:0.78em;white-space:pre-wrap;word-break:break-all;' +
                    'margin:0;border:1px solid #30363d;'
        }, 'Загрузка логов...');
        self._logsEl = logsEl;

        var logsSection = E('div', { class: 'cbi-section' }, [
            E('legend', {}, '📋 Логи'),
            E('div', { class: 'cbi-section-node' }, [ logsEl ])
        ]);

        self._startPolling();

        return E('div', {}, [
            statusSection,
            settingsSection,
            logsSection
        ]);
    },

    handleSave      : function () { return Promise.resolve(); },
    handleSaveApply : function () { return Promise.resolve(); },
    handleReset     : function () { return Promise.resolve(); }
});
