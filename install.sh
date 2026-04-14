#!/bin/sh
# =============================================================================
# Установочный скрипт OlcRTC-OpenWRT
# Проект: https://github.com/tankionline2005/OlcRTC-OpenWRT
# Основан на OlcRTC: https://github.com/openlibrecommunity/olcrtc
#   автора zarazaex / openlibrecommunity
# =============================================================================

set -e

REPO_RAW="https://raw.githubusercontent.com/tankionline2005/OlcRTC-OpenWRT/main"
BINARY_URL="${REPO_RAW}/olcrtc-linux-arm64"
BINARY_DST="/usr/bin/olcrtc"
INITD="/etc/init.d/olcrtc"
UCI_CONF="/etc/config/olcrtc"
LUCI_MENU="/usr/share/luci/menu.d/luci-app-olcrtc.json"
LUCI_ACL="/usr/share/rpcd/acl.d/luci-app-olcrtc.json"
LUCI_VIEW_DIR="/www/luci-static/resources/view/olcrtc"
LUCI_VIEW="${LUCI_VIEW_DIR}/main.js"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[ОК]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $*"; }
error() { echo -e "${RED}[ОШ]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Установка OlcRTC-OpenWRT        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Проверки ──────────────────────────────────────────────
command -v wget  >/dev/null 2>&1 || error "wget не найден"
command -v uci   >/dev/null 2>&1 || error "uci не найден (это не OpenWRT?)"

# ── Скачиваем бинарник ────────────────────────────────────
info "Скачиваем бинарник olcrtc..."
wget -q -O "$BINARY_DST" "$BINARY_URL" || \
    error "Не удалось скачать бинарник с $BINARY_URL"
chmod 755 "$BINARY_DST"
info "Бинарник установлен: $BINARY_DST"

# ── init.d скрипт ─────────────────────────────────────────
info "Устанавливаем init.d скрипт..."
wget -q -O "$INITD" "${REPO_RAW}/files/etc/init.d/olcrtc" || \
    error "Не удалось скачать init.d скрипт"
chmod 755 "$INITD"
"$INITD" enable
info "init.d скрипт установлен и включён в автозагрузку"

# ── UCI конфиг ────────────────────────────────────────────
if [ ! -f "$UCI_CONF" ]; then
    info "Создаём конфигурацию UCI..."
    wget -q -O "$UCI_CONF" "${REPO_RAW}/files/etc/config/olcrtc" || \
        error "Не удалось создать UCI конфиг"
    info "Конфиг создан: $UCI_CONF"
else
    warn "UCI конфиг уже существует, пропускаем ($UCI_CONF)"
fi

# ── LuCI: меню ────────────────────────────────────────────
info "Устанавливаем LuCI-меню..."
mkdir -p "$(dirname $LUCI_MENU)"
wget -q -O "$LUCI_MENU" "${REPO_RAW}/files/usr/share/luci/menu.d/luci-app-olcrtc.json" || \
    error "Не удалось скачать файл меню"

# ── LuCI: права доступа rpcd ──────────────────────────────
info "Устанавливаем ACL для rpcd..."
mkdir -p "$(dirname $LUCI_ACL)"
wget -q -O "$LUCI_ACL" "${REPO_RAW}/files/usr/share/rpcd/acl.d/luci-app-olcrtc.json" || \
    error "Не удалось скачать ACL"

# ── LuCI: JS-вид ──────────────────────────────────────────
info "Устанавливаем интерфейс LuCI..."
mkdir -p "$LUCI_VIEW_DIR"
wget -q -O "$LUCI_VIEW" "${REPO_RAW}/files/www/luci-static/resources/view/olcrtc/main.js" || \
    error "Не удалось скачать JS-вид LuCI"

# ── Перезапуск сервисов ───────────────────────────────────
info "Перезапускаем rpcd и uhttpd..."
/etc/init.d/rpcd    restart 2>/dev/null || warn "rpcd не перезапущен (возможно не установлен)"
/etc/init.d/uhttpd  restart 2>/dev/null || warn "uhttpd не перезапущен (возможно не установлен)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Установка завершена!                                ║"
echo "║                                                      ║"
echo "║  Откройте LuCI: Службы → OlcRTC                      ║"
echo "║  Введите провайдера, Room ID и ключ, нажмите Старт   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
