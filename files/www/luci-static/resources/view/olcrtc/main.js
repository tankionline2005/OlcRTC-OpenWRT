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

/* Управление сервисом через procd rc */
var callInitAction = rpc.declare({
    object : 'rc',
    method : 'init',
    params : [ 'name', 'action' ],
    expect : { result: 0 }
});

/* Список запущенных сервисов procd */
var callServiceList = rpc.declare({
    object : 'service',
    method : 'list',
    params : [ 'name' ],
    expect : { '': {} }
});

/* Запись значений UCI (без apply!) */
var callUciSet = rpc.declare({
    object : 'uci',
    method : 'set',
    params : [ 'config', 'section', 'values' ],
    expect : {}
});

/* Коммит UCI на диск (аналог `uci commit olcrtc`) */
var callUciCommit = rpc.declare({
    object : 'uci',
    method : 'commit',
    params : [ 'config' ],
    expect : {}
});

/* Выполнение команды (для чтения logread) */
var callExec = rpc.declare({
    object : 'file',
    method : 'exec',
    params : [ 'command', 'params', 'env' ],
    expect : { stdout: '' }
});

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
            /* Fallback: logread без фильтра, потом фильтруем сами */
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

    _pollTimer : null,
    _statusEl  : null,
    _logsEl    : null,
    _startBtn  : null,
    _stopBtn   : null,

    load: function () {
        return Promise.all([
            uci.load('olcrtc'),
            getStatus()
        ]);
    },

    /* Моментальное сохранение одного поля через ubus */
    _saveField: function (key, value) {
        var values = {};
        values[key] = value;
        callUciSet('olcrtc', 'config', values)
            .then(function () { return callUciCommit('olcrtc'); })
            .catch(function (e) {
                console.error('[OlcRTC] Ошибка сохранения UCI:', e);
            });
    },

    /* Обновление индикатора статуса и состояния кнопок */
    _updateUI: function (status) {
        if (this._statusEl) {
            var dot   = status.running ? '🟢' : '🔴';
            var label = status.running
                ? ('Работает' + (status.pid ? ' (PID\u00a0' + status.pid + ')' : ''))
                : 'Остановлен';
            this._statusEl.innerHTML = dot + ' <strong>' + label + '</strong>';
        }

        if (this._startBtn) {
            this._startBtn.disabled    = !!status.running;
            this._startBtn.style.opacity = status.running ? '0.5' : '1';
        }
        if (this._stopBtn) {
            this._stopBtn.disabled     = !status.running;
            this._stopBtn.style.opacity  = !status.running ? '0.5' : '1';
        }
    },

    /* Polling каждую секунду */
    _startPolling: function () {
        var self = this;
        if (self._pollTimer) clearInterval(self._pollTimer);

        self._pollTimer = setInterval(function () {
            Promise.all([ getStatus(), getLogs() ]).then(function (res) {
                self._updateUI(res[0]);
                if (self._logsEl) {
                    var el       = self._logsEl;
                    var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                    el.textContent = res[1];
                    if (atBottom) el.scrollTop = el.scrollHeight;
                }
            });
        }, 1000);
    },

    render: function (data) {
        var self       = this;
        var initStatus = data[1];

        /* Читаем сохранённые значения UCI */
        var cfg = {
            provider   : uci.get('olcrtc', 'config', 'provider')   || 'telemost',
            room_id    : uci.get('olcrtc', 'config', 'room_id')    || '',
            key        : uci.get('olcrtc', 'config', 'key')        || '',
            socks_port : uci.get('olcrtc', 'config', 'socks_port') || '1080',
            enabled    : uci.get('olcrtc', 'config', 'enabled')    || '0'
        };

        /* ── Блок статуса ───────────────────────────────────── */
        var statusSpan = E('span');
        self._statusEl = statusSpan;

        var startBtn = E('button', {
            class : 'btn cbi-button cbi-button-apply',
            style : 'margin-right:8px',
            click : ui.createHandlerFn(self, function () {
                return callInitAction('olcrtc', 'start')
                    .then(function () {
                        ui.addNotification(null, E('p', 'OlcRTC запущен'), 'info');
                    })
                    .catch(function (e) {
                        ui.addNotification(null,
                            E('p', 'Ошибка запуска: ' + (e.message || e)), 'error');
                    });
            })
        }, '▶ Старт');

        var stopBtn = E('button', {
            class : 'btn cbi-button cbi-button-reset',
            click : ui.createHandlerFn(self, function () {
                return callInitAction('olcrtc', 'stop')
                    .then(function () {
                        ui.addNotification(null, E('p', 'OlcRTC остановлен'), 'info');
                    })
                    .catch(function (e) {
                        ui.addNotification(null,
                            E('p', 'Ошибка остановки: ' + (e.message || e)), 'error');
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

        /* ── Поля формы (автосохранение по событию change/input) */

        var providerSel = E('select', {
            class  : 'cbi-input-select',
            change : function (ev) { self._saveField('provider', ev.target.value); }
        }, [
            E('option', { value: 'telemost',
                          selected: cfg.provider === 'telemost' ? '' : null },
                'Telemost (telemost.yandex.ru)'),
            E('option', { value: 'jazz',
                          selected: cfg.provider === 'jazz' ? '' : null },
                'Jazz (salutejazz.ru)')
        ]);

        /* Дебаунс 600 мс для текстовых полей (не спамим ubus при каждом символе) */
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

        var roomHandlers = makeDebounced('room_id');
        var roomInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'text',
            value       : cfg.room_id,
            placeholder : 'Например: 49286587700808',
            change      : roomHandlers.change,
            input       : roomHandlers.input
        });

        var keyHandlers = makeDebounced('key');
        var keyInput = E('input', {
            class       : 'cbi-input-text',
            type        : 'password',
            value       : cfg.key,
            placeholder : 'e5265a924657a8807dcef7a7b8e89562...',
            change      : keyHandlers.change,
            input       : keyHandlers.input
        });

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

        var enabledChk = E('input', {
            class  : 'cbi-input-checkbox',
            type   : 'checkbox',
            checked: cfg.enabled === '1' ? '' : null,
            change : function (ev) {
                self._saveField('enabled', ev.target.checked ? '1' : '0');
            }
        });

        var settingsSection = E('div', { class: 'cbi-section' }, [
            E('legend', {}, 'Настройки подключения'),
            E('div', { class: 'cbi-section-node' }, [
                E('p', {
                    style: 'color:#6c757d;font-size:0.88em;margin:0 0 12px;'
                }, '💾 Изменения сохраняются автоматически'),
                row('Провайдер', null, providerSel),
                row('Room ID',
                    'Идентификатор комнаты (для Telemost — числовой, для Jazz — user:code)',
                    roomInput),
                row('Ключ (key)',
                    'Общий секретный ключ сервера (hex-строка, 64 символа)',
                    keyInput),
                row('SOCKS5-порт',
                    'Локальный порт прокси (по умолчанию 1080)',
                    portInput),
                row('Автозапуск при загрузке', null, enabledChk)
            ])
        ]);

        /* ── Блок логов (развёрнут по умолчанию) ───────────── */
        var logsEl = E('pre', {
            style : 'background:#0d1117;color:#3fb950;padding:12px;' +
                    'max-height:360px;overflow-y:auto;border-radius:6px;' +
                    'font-size:0.78em;white-space:pre-wrap;word-break:break-all;' +
                    'margin:0;border:1px solid #30363d;'
        }, 'Загрузка логов...');
        self._logsEl = logsEl;

        var logsSection = E('div', { class: 'cbi-section' }, [
            E('legend', {}, '📋 Логи (logread -e olcrtc)'),
            E('div', { class: 'cbi-section-node' }, [ logsEl ])
        ]);

        /* Запускаем polling */
        self._startPolling();

        return E('div', {}, [
            statusSection,
            settingsSection,
            logsSection
        ]);
    },

    /* Отключаем стандартные кнопки LuCI Save/Apply/Reset —
       сохранение идёт автоматически через ubus, они не нужны. */
    handleSave      : function () { return Promise.resolve(); },
    handleSaveApply : function () { return Promise.resolve(); },
    handleReset     : function () { return Promise.resolve(); }
});
