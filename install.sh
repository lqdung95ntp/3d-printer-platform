#!/usr/bin/env bash
# ==============================================================================
# BeE Printer Platform - Official 1-Command Installer
# Supported OS: Debian, Ubuntu, Raspberry Pi OS, macOS, Linux x86_64 & ARM64
# Website: https://beestemsolutions.com.vn
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
echo "          BeE PRINTER PLATFORM - TRUNG TÂM QUẢN LÝ MÁY IN 3D                    "
echo "                     Powered by BeE STEM Solutions                              "
echo "================================================================================"
echo -e "${NC}"

# 1. Detect OS & Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

# Add standard Docker Desktop binary paths to PATH if present
if [ "$OS" = "Darwin" ]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:$PATH"
fi

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

# 2. Check and Auto-Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker chưa được cài đặt trên máy.${NC}"
    if [ "$OS" = "Linux" ]; then
        echo -e "${CYAN}Đang tự động cài đặt Docker qua script chính thức...${NC}"
        curl -fsSL https://get.docker.com | sh
        if [ -n "$SUDO_USER" ]; then
            usermod -aG docker "$SUDO_USER" || true
        elif [ -n "$USER" ]; then
            usermod -aG docker "$USER" || true
        fi
        echo -e "${GREEN}✅ Cài đặt Docker thành công!${NC}"
    elif [ "$OS" = "Darwin" ]; then
        echo -e "${CYAN}Đang tự động tải bộ cài Docker Desktop cho macOS (${ARCH})...${NC}"
        if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
            DMG_URL="https://desktop.docker.com/mac/main/arm64/Docker.dmg"
        else
            DMG_URL="https://desktop.docker.com/mac/main/amd64/Docker.dmg"
        fi
        echo -e "${CYAN}Đang tải trực tiếp từ máy chủ Docker (khoảng 600MB)...${NC}"
        curl -# -fL -o /tmp/Docker.dmg "$DMG_URL"
        echo -e "${CYAN}Đang giải nén và cài đặt Docker.app vào thư mục /Applications...${NC}"
        MOUNT_DIR=$(mktemp -d /tmp/docker_mount.XXXXXX)
        hdiutil attach /tmp/Docker.dmg -nobrowse -mountpoint "$MOUNT_DIR" -quiet || hdiutil attach /tmp/Docker.dmg -nobrowse -quiet
        if [ -d "$MOUNT_DIR/Docker.app" ]; then
            cp -R "$MOUNT_DIR/Docker.app" /Applications/ || sudo cp -R "$MOUNT_DIR/Docker.app" /Applications/
            hdiutil detach "$MOUNT_DIR" -quiet || true
        elif [ -d "/Volumes/Docker/Docker.app" ]; then
            cp -R /Volumes/Docker/Docker.app /Applications/ || sudo cp -R /Volumes/Docker/Docker.app /Applications/
            hdiutil detach /Volumes/Docker -quiet || true
        fi
        rm -rf "$MOUNT_DIR" /tmp/Docker.dmg
        export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:$PATH"
        echo -e "${GREEN}✅ Đã cài đặt Docker Desktop thành công!${NC}"
    elif [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
        echo -e "${CYAN}Phát hiện Windows (Git Bash/MSYS). Đang cài đặt Docker Desktop...${NC}"
        if command -v winget.exe >/dev/null 2>&1; then
            winget.exe install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
        else
            echo -e "${CYAN}Đang tải Docker Desktop Installer.exe...${NC}"
            curl -L -o /tmp/DockerInstaller.exe "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
            /tmp/DockerInstaller.exe install --quiet
            rm -f /tmp/DockerInstaller.exe
        fi
        echo -e "${GREEN}✅ Cài đặt Docker Desktop thành công!${NC}"
    else
        echo -e "${RED}❌ Hệ điều hành ${OS} chưa hỗ trợ tự động cài Docker. Vui lòng cài Docker thủ công.${NC}"
        exit 1
    fi
fi

# 3. Ensure Docker Daemon is Running
if ! docker info >/dev/null 2>&1; then
    if [ "$OS" = "Darwin" ]; then
        echo -e "${CYAN}Đang khởi động Docker Desktop...${NC}"
        open -a Docker || true
        echo -n "Đang chờ Docker daemon sẵn sàng"
        for i in {1..35}; do
            if docker info >/dev/null 2>&1; then
                echo -e "\n${GREEN}✅ Docker daemon đã sẵn sàng!${NC}"
                break
            fi
            echo -n "."
            sleep 2
        done
        if ! docker info >/dev/null 2>&1; then
            echo -e "\n${YELLOW}⚠️  Docker Desktop đang cần cấp quyền lần đầu.${NC}"
            echo -e "${YELLOW}Vui lòng mở ứng dụng Docker Desktop trên màn hình, bấm Accept/Đồng ý, sau đó chạy lại script.${NC}"
            exit 0
        fi
    elif [ "$OS" = "Linux" ]; then
        echo -e "${CYAN}Đang khởi động Docker service...${NC}"
        sudo systemctl start docker || sudo service docker start || true
    fi
fi

# 4. Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ Không tìm thấy docker compose. Vui lòng cài đặt docker compose plugin.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker & Compose sẵn sàng!${NC}"

# 5. Check and Download Project Files if running from a clean directory
WORKDIR="$(pwd)"
if [ ! -f "docker-compose.yml" ]; then
    INSTALL_DIR="3d-printer-platform"
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${CYAN}Thư mục ${INSTALL_DIR} đã tồn tại, đang đồng bộ phiên bản mới nhất...${NC}"
        cd "$INSTALL_DIR"
        if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
            git pull origin main || true
        fi
        WORKDIR="$(pwd)"
    else
        echo -e "${CYAN}Đang tải mã nguồn BeE Printer Platform từ GitHub...${NC}"
        if command -v git >/dev/null 2>&1; then
            git clone https://github.com/lqdung95ntp/3d-printer-platform.git "$INSTALL_DIR"
            cd "$INSTALL_DIR"
            WORKDIR="$(pwd)"
        else
            mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"
            curl -fsSL https://github.com/lqdung95ntp/3d-printer-platform/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1
            WORKDIR="$(pwd)"
        fi
    fi
    echo -e "${GREEN}✅ Đã chuẩn bị mã nguồn tại: ${WORKDIR}${NC}"
fi

# Hand off to the freshly updated local script if invoked from curl pipe
if [ -z "$BEE_INSTALL_REEXEC" ] && [ -f "${WORKDIR}/install.sh" ]; then
    export BEE_INSTALL_REEXEC=1
    exec bash "${WORKDIR}/install.sh" "$@"
fi

echo -e "${BLUE}Thư mục triển khai: ${BOLD}${WORKDIR}${NC}"

mkdir -p "${WORKDIR}/data/core" "${WORKDIR}/data/pro" "${WORKDIR}/logs"

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

# Detect port collision on host
is_port_in_use() {
    local check_port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -tuln 2>/dev/null | grep -q -E ":${check_port}\s" && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln 2>/dev/null | grep -q -E ":${check_port}\s" && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"${check_port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    fi
    return 1
}

# Auto-reassign Web Dashboard port if occupied
if is_port_in_use "$BEE_PORT"; then
    echo -e "${YELLOW}⚠️  Cổng ${BEE_PORT} đang được sử dụng bởi một dịch vụ khác trên máy.${NC}"
    for alt_port in 8080 8088 8888 9000 8008; do
        if ! is_port_in_use "$alt_port"; then
            echo -e "${CYAN}🔄 Tự động chuyển cổng Web sang: ${BOLD}${alt_port}${NC}"
            BEE_PORT="$alt_port"
            if grep -q '^BEE_PORT=' "${WORKDIR}/.env"; then
                sed -i.bak "s/^BEE_PORT=.*/BEE_PORT=${BEE_PORT}/" "${WORKDIR}/.env" && rm -f "${WORKDIR}/.env.bak"
            else
                echo "BEE_PORT=${BEE_PORT}" >> "${WORKDIR}/.env"
            fi
            break
        fi
    done
fi

# Auto-reassign Pro Sidecar host port if 8001 is occupied
BEE_PRO_PORT=$(grep -E '^BEE_PRO_PORT=' "${WORKDIR}/.env" | cut -d '=' -f2 | tr -d ' ')
if [ -z "$BEE_PRO_PORT" ]; then
    BEE_PRO_PORT=8001
fi
if is_port_in_use "$BEE_PRO_PORT"; then
    for alt_pro in 8002 8003 8004 8005; do
        if ! is_port_in_use "$alt_pro"; then
            echo -e "${CYAN}🔄 Cổng Pro Sidecar ${BEE_PRO_PORT} đã bận, tự động gán BEE_PRO_PORT=${alt_pro}${NC}"
            BEE_PRO_PORT="$alt_pro"
            if grep -q '^BEE_PRO_PORT=' "${WORKDIR}/.env"; then
                sed -i.bak "s/^BEE_PRO_PORT=.*/BEE_PRO_PORT=${BEE_PRO_PORT}/" "${WORKDIR}/.env" && rm -f "${WORKDIR}/.env.bak"
            else
                echo "BEE_PRO_PORT=${BEE_PRO_PORT}" >> "${WORKDIR}/.env"
            fi
            break
        fi
    done
fi

# 6. Launch System via Docker Compose
export BEE_PORT BEE_PRO_PORT
echo -e "${CYAN}Đang tải container images mới nhất từ GitHub Packages...${NC}"
$COMPOSE_CMD pull
echo -e "${CYAN}Đang khởi động hệ thống BeE Printer Platform (Core & Pro Sidecar)...${NC}"
$COMPOSE_CMD up -d

# 7. Detect IP Address
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
echo "          BeE PRINTER PLATFORM ĐÃ KHỞI CHẠY THÀNH CÔNG                          "
echo "================================================================================"
echo -e "${NC}"
echo -e "${BOLD}Mở trình duyệt web và truy cập Dashboard tại:${NC}"
echo -e "   URL: ${CYAN}${BOLD}http://${SERVER_IP}:${BEE_PORT}${NC}"
if [ "$SERVER_IP" != "localhost" ]; then
    echo -e "   Local: ${CYAN}http://localhost:${BEE_PORT}${NC}"
fi
echo ""
echo -e "${BOLD}Lệnh quản lý thông dụng:${NC}"
echo -e "   • Xem log hệ thống:      ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
echo -e "   • Khởi động lại:         ${YELLOW}${COMPOSE_CMD} restart${NC}"
echo -e "   • Dừng hệ thống:         ${YELLOW}${COMPOSE_CMD} down${NC}"
echo -e "   • Cập nhật bản mới nhất: ${YELLOW}${COMPOSE_CMD} pull && ${COMPOSE_CMD} up -d${NC}"
echo ""
echo -e "${BLUE}Hỗ trợ kỹ thuật & Cộng đồng: https://beestemsolutions.com.vn${NC}"
echo "================================================================================"
