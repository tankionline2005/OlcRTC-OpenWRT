# OlcRTC-OpenWRT

Панель управления LuCI для запуска [OlcRTC](https://github.com/openlibrecommunity/olcrtc) в режиме клиента на роутере с OpenWRT.

> [!NOTE] 
> **OlcRTC** — проект [zarazaex](https://github.com/zarazaex69) / [openlibrecommunity](https://github.com/openlibrecommunity).  
> Реализация обхода блокировок через WebRTC-туннели поверх разрешённых сервисов.  

> [!CAUTION]
> OlcRTC находится в статусе pre-alpha, возможны любые непресказуемые ошибки!

## Что это такое

OlcRTC запускается на роутере как SOCKS5-прокси.
Весь трафик браузера или устройства, направленный через этот прокси, проходит по зашифрованному WebRTC-туннелю через разрешённый в России сервис, что позволяет обходить блокировки.

Данный проект добавляет удобный веб-интерфейс в стандартное меню LuCI (**Службы → OlcRTC**).

## Возможности

- Выбор провайдера: **Telemost** или **Jazz**
- Ввод Room ID, ключа и SOCKS5-порта
- Кнопки **Старт** и **Стоп**
- Индикатор статуса с PID
- Отображение логов

## Требования

- OpenWRT с LuCI (проверено на OpenWrt 25.12.1 & Luci 0.7.14)
- Архитектура: **ARM64** (aarch64) — например, роутер Cudy WR3000S

> Если у вас другая архитектура — соберите бинарник самостоятельно из [исходников OlcRTC](https://github.com/openlibrecommunity/olcrtc), ниже будет описано как это сделать. (Рекомендую собрать самостоятельно, а не слепо скачивать у меня =)

- Свободное место: 10 МБ
- Удалённый VPS сервер на Linux для запуска OlcRTC сервера (Ниже будет описано как его запустить)
---

## Установка клиента на роутер

Подключитесь к роутеру по SSH и выполните:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/tankionline2005/OlcRTC-OpenWRT/main/install.sh)"
```

## Использование прокси

После запуска на роутере доступен SOCKS5-прокси:

```
Хост:  <IP роутера> или 127.0.0.1
Порт:  1080  (или тот, что вы указали)
Тип:   SOCKS5
```

Укажите эти настройки в браузере, приложении или в установленном сервисе (Например podkop)

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
## Как скомпилировать OlcRTC под свой роутер?

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

Скачайте репозиторий OlcRTC
```
git clone https://github.com/openlibrecommunity/olcrtc
cd olcrtc
```

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
## Как запустить OlcRTC сервер на своём Linux VPS ?
Клонируйте репозиторий OlcRTC:
```
git clone https://github.com/openlibrecommunity/olcrtc
cd olcrtc
```
Запускайте:
Вариант А - через Podman, проще всего (Но каждый раз нужно долго ждать):
```
./script/srv.sh
```
Вариант Б - собрать нативно. Рекомендуется, т.к. ждать придётся только один раз при сборке, экономия времени =)
```
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-linux-amd64 ./cmd/olcrtc
```
Сборка для windows (у вас в европе обычный пк на винде):
```
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o build/olcrtc-windows-amd64.exe ./cmd/olcrtc
$env:GOOS="windows"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"; go build -trimpath -ldflags="-s -w" -o build/olcrtc-windows-amd64.exe ./cmd/olcrtc
```
> Вариант для ленивых - скачать готовый бинарники из этого репозитория
> olcrtc-linux-amd64 или olcrtc-windows-amd64.exe

Запускаете бинарник, указывая параметры:
```
./build/olcrtc-linux-amd64 -mode srv -provider "telemost" -id "06627677819234"
./build/olcrtc-linux-amd64 -mode srv -provider "jazz" -id "any"
```
