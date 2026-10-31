#!/usr/bin/env bash
# ==============================================================================
# BeE Printer Platform - Official 1-Command Installer
# Supported OS: Debian, Ubuntu, Raspberry Pi OS, macOS, Linux x86_64 & ARM64
# Website: https://beestemsolutions.com
# ==============================================================================
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "================================================================================"
echo "          BeE PRINTER PLATFORM - TRUNG TÂM QUẢN LÝ NÔNG TRẠI IN 3D              "
echo "                       Powered by BeeStem Solutions                            "
echo "================================================================================"
echo -e "${NC}"

# 1. Detect OS & Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "${BLUE}ℹ️  Kiểm tra hệ thống: HĐH ${BOLD}${OS}${NC}${BLUE}, Kiến trúc CPU: ${BOLD}${ARCH}${NC}"

case "$ARCH" in
    x86_64)
        DOCKER_ARCH="amd64"
        ;;
    aarch64|arm64)
        DOCKER_ARCH="arm64"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Cảnh báo: Kiến trúc ${ARCH} có thể cần tự build container.${NC}"
        ;;
esac

# 2. Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}⚙️  Docker chưa được cài đặt trên máy.${NC}"
    if [ "$OS" = "Linux" ]; then
        echo -e "${CYAN}🚀 Đang tự động cài đặt Docker qua script chính thức...${NC}"
        curl -fsSL https://get.docker.com | sh
        if [ -n "$SUDO_USER" ]; then
            usermod -aG docker "$SUDO_USER" || true
        elif [ -n "$USER" ]; then
            usermod -aG docker "$USER" || true
        fi
        echo -e "${GREEN}✅ Cài đặt Docker thành công!${NC}"
    else
        echo -e "${RED}❌ Vui lòng cài đặt Docker Desktop trước khi chạy script này trên macOS/Windows.${NC}"
        exit 1
    fi
fi

# 3. Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ Không tìm thấy docker compose. Vui lòng cài đặt docker compose plugin.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker & Compose sẵn sàng!${NC}"

# 4. Setup Directories & Environment
WORKDIR="$(pwd)"
echo -e "${BLUE}📂 Thư mục triển khai: ${BOLD}${WORKDIR}${NC}"

mkdir -p "${WORKDIR}/data" "${WORKDIR}/logs"

if [ ! -f "${WORKDIR}/.env" ]; then
    if [ -f "${WORKDIR}/.env.example" ]; then
        cp "${WORKDIR}/.env.example" "${WORKDIR}/.env"
        echo -e "${GREEN}✅ Đã tạo file cấu hình .env mặc định (Cổng Web: 8000).${NC}"
    else
        cat << 'EOF' > "${WORKDIR}/.env"
BEE_PORT=8000
TZ=Asia/Ho_Chi_Minh
DATA_PATH=./data
EOF
        echo -e "${GREEN}✅ Đã khởi tạo file .env.${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Đã tồn tại file .env, giữ nguyên cấu hình hiện tại.${NC}"
fi

# Read port from .env
BEE_PORT=$(grep -E '^BEE_PORT=' "${WORKDIR}/.env" | cut -d '=' -f2 | tr -d ' ' || echo "8000")
if [ -z "$BEE_PORT" ]; then
    BEE_PORT=8000
fi

# 5. Launch System via Docker Compose
echo -e "${CYAN}🚀 Đang khởi động hệ thống BeE Printer Platform (Core & Pro Sidecar)...${NC}"
$COMPOSE_CMD up -d

# 6. Detect IP Address
SERVER_IP="localhost"
if [ "$OS" = "Linux" ]; then
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    if [ -n "$DETECTED_IP" ]; then
        SERVER_IP="$DETECTED_IP"
    fi
elif [ "$OS" = "Darwin" ]; then
    DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
    if [ -n "$DETECTED_IP" ]; then
        SERVER_IP="$DETECTED_IP"
    fi
fi

echo -e "\n${GREEN}${BOLD}"
echo "================================================================================"
echo "          🎉 BeE PRINTER PLATFORM ĐÃ KHỞI CHẠY THÀNH CÔNG!                      "
echo "================================================================================"
echo -e "${NC}"
echo -e "${BOLD}🌐 Mở trình duyệt web và truy cập Dashboard tại:${NC}"
echo -e "   👉 ${CYAN}${BOLD}http://${SERVER_IP}:${BEE_PORT}${NC}"
if [ "$SERVER_IP" != "localhost" ]; then
    echo -e "   👉 ${CYAN}http://localhost:${BEE_PORT}${NC} (Nếu mở trực tiếp trên máy này)"
fi
echo ""
echo -e "${BOLD}📌 Các lệnh quản lý thông dụng:${NC}"
echo -e "   • Xem log hệ thống:      ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
echo -e "   • Khởi động lại:         ${YELLOW}${COMPOSE_CMD} restart${NC}"
echo -e "   • Dừng hệ thống:         ${YELLOW}${COMPOSE_CMD} down${NC}"
echo -e "   • Cập nhật bản mới nhất: ${YELLOW}${COMPOSE_CMD} pull && ${COMPOSE_CMD} up -d${NC}"
echo ""
echo -e "${BLUE}Hỗ trợ kỹ thuật & Cộng đồng: https://beestemsolutions.com${NC}"
echo "================================================================================"

