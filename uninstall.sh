#!/bin/sh
# =============================================================================
# Скрипт удаления OlcRTC-OpenWRT
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[ОК]${NC} $*"; }
warn() { echo -e "${YELLOW}[!!]${NC} $*"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Удаление OlcRTC-OpenWRT         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Останавливаем и отключаем сервис
if [ -f /etc/init.d/olcrtc ]; then
    /etc/init.d/olcrtc stop    2>/dev/null || true
    /etc/init.d/olcrtc disable 2>/dev/null || true
    rm -f /etc/init.d/olcrtc
    info "init.d скрипт удалён"
fi

# Удаляем бинарник
rm -f /usr/bin/olcrtc && info "Бинарник удалён" || true
# Для совместимости со старыми версиями
rm -f /usr/bin/olcrtc-arm64 2>/dev/null || true
rm -f /usr/bin/olcrtc-amd64 2>/dev/null || true

# Удаляем UCI конфиг
if [ -f /etc/config/olcrtc ]; then
    rm -f /etc/config/olcrtc
    info "UCI конфиг удалён"
fi

# Удаляем файлы LuCI
rm -f  /usr/share/luci/menu.d/luci-app-olcrtc.json  && info "LuCI меню удалено"
rm -f  /usr/share/rpcd/acl.d/luci-app-olcrtc.json   && info "ACL rpcd удалён"
rm -rf /www/luci-static/resources/view/olcrtc        && info "LuCI вид удалён"

# Перезапуск веб-сервера
/etc/init.d/rpcd   restart 2>/dev/null || warn "rpcd не перезапущен"
/etc/init.d/uhttpd restart 2>/dev/null || warn "uhttpd не перезапущен"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  OlcRTC-OpenWRT успешно удалён!      ║"
echo "╚══════════════════════════════════════╝"
echo ""
