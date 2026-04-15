# OlcRTC-OpenWRT

Панель управления LuCI для запуска [OlcRTC](https://github.com/openlibrecommunity/olcrtc) в режиме клиента на роутере с OpenWRT.

> **OlcRTC** — проект [zarazaex](https://github.com/zarazaex69) / [openlibrecommunity](https://github.com/openlibrecommunity).  
> Реализация обхода блокировок через WebRTC-туннели поверх разрешённых сервисов.  

---

## Что это такое

OlcRTC запускается на роутере как SOCKS5-прокси.
Весь трафик браузера или устройства, направленный через этот прокси, проходит по зашифрованному WebRTC-туннелю через разрешённый в России сервис, что позволяет обходить блокировки.

Данный проект добавляет удобный веб-интерфейс в стандартное меню LuCI (**Службы → OlcRTC**).

---

## Возможности

- Выбор провайдера: **Telemost** или **Jazz**
- Ввод Room ID, ключа и SOCKS5-порта
- Кнопки **Старт / Перезапуск** и **Стоп**
- Индикатор статуса с PID
- Отображение логов
- Настройки сохраняются через UCI (`/etc/config/olcrtc`)
- Автозапуск при старте роутера (опционально)

---

## Требования

- OpenWRT с LuCI (проверено на OpenWrt 25.12.1 & Luci 0.7.14)
- Архитектура: **ARM64** (aarch64) — например, роутер Cudy WR3000S
- Свободное место: 10 МБ

> Если у вас другая архитектура — соберите бинарник самостоятельно из [исходников OlcRTC](https://github.com/openlibrecommunity/olcrtc), ниже будет описано как это сделать

---

## Установка

Подключитесь к роутеру по SSH и выполните:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/tankionline2005/OlcRTC-OpenWRT/main/install.sh)"
```

---

## Использование прокси

После запуска на роутере доступен SOCKS5-прокси:

```
Хост:  <IP роутера> или 127.0.0.1
Порт:  1080  (или тот, что вы указали)
Тип:   SOCKS5
```

Укажите эти настройки в браузере, приложении или в установленном сервисе (Например podkop)

---

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

---

## Структура проекта

```
OlcRTC-OpenWRT/
├── README.md
├── install.sh                   # Установочный скрипт
├── uninstall.sh                 # Скрипт удаления
├── olcrtc-linux-arm64           # Скомпилированный бинарник, рекомендуется скомпилировать самостоятельно из исходников OlcRTC, а не слепо доверять мне =)
└── files/
    ├── etc/
    │   ├── config/olcrtc        # UCI конфиг по умолчанию
    │   └── init.d/olcrtc        # Сервисный скрипт (procd)
    ├── usr/share/
    │   ├── luci/menu.d/         # Пункт меню LuCI
    │   └── rpcd/acl.d/          # Права доступа
    └── www/luci-static/
        └── resources/view/olcrtc/main.js  # Веб-интерфейс
```

---
## Как скомпилировать?

Определите архитектуру своего роутера.
Подключитесь к роутеру по SSH и выполните:
```
shcat /proc/cpuinfo | grep cpu | head -1
uname -m
```

В большинстве случаев всё сразу становится понятно:

mips (big-endian) — mips

mipsle / mips32le — mipsle

aarch64 / arm64 — arm64

armv7 — arm + GOARM=7

x86_64 — amd64

---

Скачайте репозиторий OlcRTC
```
git clone https://github.com/openlibrecommunity/olcrtc
cd olcrtc
```

---

Скомпилируйте (команды для Linux/Microsoft PowerShell):


mips big-endian (некоторые Mikrotik, Netgear)
```
GOOS=linux GOARCH=mips CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-mips ./cmd/olcrtc

$env:GOOS="linux"; $env:GOARCH="mips"; $env:CGO_ENABLED="0"; go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-mips ./cmd/olcrtc
```

mipsle (большинство старых роутеров — TP-Link, Xiaomi и др.)
```
GOOS=linux GOARCH=mipsle CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-mipsle ./cmd/olcrtc

$env:GOOS="linux"; $env:GOARCH="mipsle"; $env:CGO_ENABLED="0"; go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-mipsle ./cmd/olcrtc
```

arm64 (более новые роутеры — Xiaomi AX3600, Cudy WR3000S и др.)
```
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-arm64 ./cmd/olcrtc

$env:GOOS="linux"; $env:GOARCH="arm64"; $env:CGO_ENABLED="0"; go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-arm64 ./cmd/olcrtc
```

armv7
```
GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-armv7 ./cmd/olcrtc

$env:GOOS="linux"; $env:GOARCH="arm"; $env:GOARM="7"; $env:CGO_ENABLED="0"; go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-armv7 ./cmd/olcrtc
```
---

## Благодарность

- [zarazaex](https://t.me/zarazaexe) и [openlibrecommunity](https://github.com/openlibrecommunity) — за создание OlcRTC
