# OlcRTC-OpenWRT

Панель управления LuCI для запуска [OlcRTC](https://github.com/openlibrecommunity/olcrtc) в режиме клиента на роутере с OpenWRT.

> [!NOTE] 
> **OlcRTC** — проект [zarazaex](https://github.com/zarazaex69) / [openlibrecommunity](https://github.com/openlibrecommunity).  
> Реализация обхода блокировок через WebRTC-туннели поверх разрешённых сервисов.  

> [!CAUTION]
> OlcRTC находится в статусе beta, возможны любые непредсказуемые ошибки!

## Что это такое

OlcRTC запускается на роутере как SOCKS5-прокси.
Весь трафик браузера или устройства, направленный через этот прокси, проходит по зашифрованному WebRTC-туннелю через разрешённый в России сервис, что позволяет обходить блокировки.

Данный проект добавляет удобный веб-интерфейс в стандартное меню LuCI (**Службы → OlcRTC**).

## Возможности

- Выбор сервиса: **Telemost**, **Jazz**, **Wildberries Stream**
- Выбор транспорта: **datachannel**, **vp8channel**, **seichannel**, **videochannel**
- Ввод Room ID, Client ID, ключа шифрования, SOCKS5-порта и DNS-сервера
- Кнопки **Старт** и **Стоп**
- Индикатор статуса с PID
- Отображение логов

## Требования

- OpenWRT с LuCI (проверено на OpenWrt 25.12.1 & LuCI 0.7.14)
- Архитектура: **ARM64** (aarch64) — например, роутер Cudy WR3000S

> Если у вас другая архитектура — соберите бинарник самостоятельно из [исходников OlcRTC](https://github.com/openlibrecommunity/olcrtc), там описано как это сделать.

- Свободное место: ~10 МБ
- Удалённый сервер (VPS) для запуска серверной части OlcRTC — как это сделать описано в [документации OlcRTC](https://github.com/openlibrecommunity/olcrtc/blob/master/docs/fast.md)

---

## Установка клиента на роутер

Подключитесь к роутеру по SSH и выполните:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/tankionline2005/OlcRTC-OpenWRT/main/install.sh)"
```

После установки откройте LuCI → **Службы → OlcRTC** и заполните:
- **Сервис** и **Транспорт** — должны совпадать с сервером
- **Room ID** — скопируйте из логов сервера при первом запуске
- **Client ID** — произвольная строка без пробелов, одинаковая на сервере и клиенте
- **Ключ шифрования** — скопируйте с сервера (64 символа HEX)

## Использование прокси

После запуска на роутере доступен SOCKS5-прокси:

```
Хост:  <IP роутера>
Порт:  1080  (или тот, что вы указали)
Тип:   SOCKS5
```

Укажите эти настройки в браузере, приложении или в установленном сервисе (например, podkop).

## Удаление

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/tankionline2005/OlcRTC-OpenWRT/main/uninstall.sh)"
```

Или вручную:

```sh
/etc/init.d/olcrtc stop
/etc/init.d/olcrtc disable
rm -f /usr/bin/olcrtc
rm -f /etc/init.d/olcrtc
rm -f /etc/config/olcrtc
rm -f /usr/share/luci/menu.d/luci-app-olcrtc.json
rm -f /usr/share/rpcd/acl.d/luci-app-olcrtc.json
rm -rf /www/luci-static/resources/view/olcrtc
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```
