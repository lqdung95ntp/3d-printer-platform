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

# Add standard Docker Desktop & Tailscale binary paths to PATH if present
if [ "$OS" = "Darwin" ]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:$PATH"
elif [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
    if [ -d "/c/Program Files/Tailscale" ]; then
        export PATH="/c/Program Files/Tailscale:$PATH"
    fi
fi

echo -e "${BLUE}[INFO]${NC} Kiểm tra hệ thống: HĐH ${BOLD}${OS}${NC}, Kiến trúc CPU: ${BOLD}${ARCH}${NC}"

case "$ARCH" in
    x86_64)
        DOCKER_ARCH="amd64"
        ;;
    aarch64|arm64)
        DOCKER_ARCH="arm64"
        ;;
    *)
        echo -e "${YELLOW}[WARN]${NC} Kiến trúc ${ARCH} có thể cần tự build container."
        ;;
esac

# 2. Check and Auto-Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}[WARN]${NC} Docker chưa được cài đặt trên máy."
    if [ "$OS" = "Linux" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang tự động cài đặt Docker qua script chính thức..."
        curl -fsSL https://get.docker.com | sh
        if [ -n "$SUDO_USER" ]; then
            usermod -aG docker "$SUDO_USER" || true
        elif [ -n "$USER" ]; then
            usermod -aG docker "$USER" || true
        fi
        echo -e "${GREEN}[✓] Cài đặt Docker thành công!${NC}"
    elif [ "$OS" = "Darwin" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang tự động tải bộ cài Docker Desktop cho macOS (${ARCH})..."
        if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
            DMG_URL="https://desktop.docker.com/mac/main/arm64/Docker.dmg"
        else
            DMG_URL="https://desktop.docker.com/mac/main/amd64/Docker.dmg"
        fi
        echo -e "${CYAN}[INFO]${NC} Đang tải trực tiếp từ máy chủ Docker (khoảng 600MB)..."
        curl -# -fL -o /tmp/Docker.dmg "$DMG_URL"
        echo -e "${CYAN}[INFO]${NC} Đang giải nén và cài đặt Docker.app vào thư mục /Applications..."
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
        echo -e "${GREEN}[✓] Đã cài đặt Docker Desktop thành công!${NC}"
    elif [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
        echo -e "${CYAN}[INFO]${NC} Phát hiện Windows (Git Bash/MSYS). Đang cài đặt Docker Desktop..."
        if command -v winget.exe >/dev/null 2>&1; then
            winget.exe install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
        else
            echo -e "${CYAN}[INFO]${NC} Đang tải Docker Desktop Installer.exe..."
            curl -L -o /tmp/DockerInstaller.exe "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
            /tmp/DockerInstaller.exe install --quiet
            rm -f /tmp/DockerInstaller.exe
        fi
        echo -e "${GREEN}[✓] Cài đặt Docker Desktop thành công!${NC}"
    else
        echo -e "${RED}[ERROR]${NC} Hệ điều hành ${OS} chưa hỗ trợ tự động cài Docker. Vui lòng cài Docker thủ công."
        exit 1
    fi
fi

# 3. Ensure Docker Daemon is Running
if ! docker info >/dev/null 2>&1; then
    if [ "$OS" = "Darwin" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang khởi động Docker Desktop..."
        open -a Docker || true
        echo -n "Đang chờ Docker daemon sẵn sàng"
        for i in {1..35}; do
            if docker info >/dev/null 2>&1; then
                echo -e "\n${GREEN}[✓] Docker daemon đã sẵn sàng!${NC}"
                break
            fi
            echo -n "."
            sleep 2
        done
        if ! docker info >/dev/null 2>&1; then
            echo -e "\n${YELLOW}[WARN]${NC} Docker Desktop đang cần cấp quyền lần đầu."
            echo -e "${YELLOW}[WARN]${NC} Vui lòng mở ứng dụng Docker Desktop trên màn hình, bấm Accept/Đồng ý, sau đó chạy lại script."
            exit 0
        fi
    elif [ "$OS" = "Linux" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang khởi động Docker service..."
        sudo systemctl start docker || sudo service docker start || true
    fi
fi

# 4. Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR]${NC} Không tìm thấy docker compose. Vui lòng cài đặt docker compose plugin."
    exit 1
fi
echo -e "${GREEN}[✓] Docker & Compose sẵn sàng!${NC}"

# 5. Check and Download Project Files if running from a clean directory
WORKDIR="$(pwd)"
if [ ! -f "docker-compose.yml" ]; then
    INSTALL_DIR="3d-printer-platform"
    if [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
        WORKDIR="$(pwd)"
    else
        mkdir -p "$INSTALL_DIR"
        cd "$INSTALL_DIR"
        WORKDIR="$(pwd)"
    fi
fi

# Ensure docker-compose.yml and repository files exist in WORKDIR
if [ ! -f "${WORKDIR}/docker-compose.yml" ]; then
    echo -e "${CYAN}[INFO]${NC} Đang tải bộ cài đặt BeE Printer Platform từ GitHub..."
    if command -v git >/dev/null 2>&1; then
        if [ ! -d "${WORKDIR}/.git" ]; then
            git clone https://github.com/lqdung95ntp/3d-printer-platform.git . 2>/dev/null || {
                # If directory not empty, fallback to fetch/checkout or tarball
                git init
                git checkout -B main 2>/dev/null || true
                git remote add origin https://github.com/lqdung95ntp/3d-printer-platform.git 2>/dev/null || git remote set-url origin https://github.com/lqdung95ntp/3d-printer-platform.git
                git fetch origin main --depth=1 || true
                git checkout -f main || true
            }
        else
            git pull origin main || true
        fi
    else
        curl -fsSL https://github.com/lqdung95ntp/3d-printer-platform/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1
    fi
else
    # Directory already has docker-compose.yml, pull updates if git repository
    if command -v git >/dev/null 2>&1 && [ -d "${WORKDIR}/.git" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang đồng bộ phiên bản mới nhất từ GitHub..."
        git pull origin main || true
    fi
fi

# Final check for docker-compose.yml
if [ ! -f "${WORKDIR}/docker-compose.yml" ]; then
    echo -e "${YELLOW}[WARN]${NC} Đang tải trực tiếp docker-compose.yml từ GitHub..."
    curl -fsSL https://raw.githubusercontent.com/lqdung95ntp/3d-printer-platform/main/docker-compose.yml -o "${WORKDIR}/docker-compose.yml" || true
fi

echo -e "${GREEN}[✓] Đã chuẩn bị mã nguồn tại: ${WORKDIR}${NC}"

# Hand off to the freshly updated local script if invoked from curl pipe
if [ -z "$BEE_INSTALL_REEXEC" ] && [ -f "${WORKDIR}/install.sh" ]; then
    export BEE_INSTALL_REEXEC=1
    cd "${WORKDIR}"
    exec bash "${WORKDIR}/install.sh" "$@"
fi

cd "${WORKDIR}"
echo -e "${BLUE}[INFO]${NC} Thư mục triển khai: ${BOLD}${WORKDIR}${NC}"

mkdir -p "${WORKDIR}/data/core" "${WORKDIR}/data/pro" "${WORKDIR}/logs"

if [ ! -f "${WORKDIR}/.env" ]; then
    if [ -f "${WORKDIR}/.env.example" ]; then
        cp "${WORKDIR}/.env.example" "${WORKDIR}/.env"
        echo -e "${GREEN}[✓] Đã tạo file cấu hình .env mặc định (Cổng Web: 8000).${NC}"
    else
        cat << 'EOF' > "${WORKDIR}/.env"
BEE_PORT=8000
TZ=Asia/Ho_Chi_Minh
DATA_PATH=./data
EOF
        echo -e "${GREEN}[✓] Đã khởi tạo file .env.${NC}"
    fi
else
    echo -e "${BLUE}[INFO]${NC} Đã tồn tại file .env, giữ nguyên cấu hình hiện tại."
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
    echo -e "${YELLOW}[WARN]${NC} Cổng ${BEE_PORT} đang được sử dụng bởi một dịch vụ khác trên máy."
    for alt_port in 8080 8088 8888 9000 8008; do
        if ! is_port_in_use "$alt_port"; then
            echo -e "${CYAN}[INFO]${NC} Tự động chuyển cổng Web sang: ${BOLD}${alt_port}${NC}"
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
            echo -e "${CYAN}[INFO]${NC} Cổng Pro Sidecar ${BEE_PRO_PORT} đã bận, tự động gán BEE_PRO_PORT=${alt_pro}"
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
echo -e "${CYAN}[INFO]${NC} Đang tải container images mới nhất từ GitHub Packages..."
$COMPOSE_CMD pull
echo -e "${CYAN}[INFO]${NC} Đang khởi động hệ thống BeE Printer Platform (Core & Pro Sidecar)..."
$COMPOSE_CMD up -d

# 7. Detect Local / LAN IP Address
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

# 8. Optional Tailscale Configuration for Remote Access (4G / WAN)
TAILSCALE_IP=""
if command -v tailscale >/dev/null 2>&1; then
    TS_STATUS=$(tailscale status 2>/dev/null || true)
    if [ -n "$TS_STATUS" ] && ! echo "$TS_STATUS" | grep -qi "NeedsLogin\|Logged out\|stopped"; then
        TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || true)
    fi
fi

if [ -n "$TAILSCALE_IP" ]; then
    echo -e "${GREEN}[✓] Đã phát hiện kết nối Tailscale (IP: ${TAILSCALE_IP})${NC}"
else
    INSTALL_TS="n"
    # Prompt user if running in interactive terminal
    if [ -t 0 ] || [ -r /dev/tty ]; then
        echo ""
        echo -e "${CYAN}--------------------------------------------------------------------------------${NC}"
        echo -e "${BOLD}CẤU HÌNH TRUY CẬP TỪ XA NGOÀI MẠNG LAN (TAILSCALE)${NC}"
        echo -e "${CYAN}--------------------------------------------------------------------------------${NC}"
        echo -e "Tailscale cho phép bạn theo dõi và điều khiển máy in từ 4G / mạng ngoài an toàn."
        echo -e "Đăng nhập nhanh bằng tài khoản Google, Apple, Microsoft hoặc GitHub."
        echo ""
        
        # Read from /dev/tty if available (works even when script is run via curl | bash)
        if [ -r /dev/tty ]; then
            read -t 60 -r -p "Bạn có muốn cài đặt / kết nối Tailscale ngay không? [y/N]: " USER_TS_CHOICE < /dev/tty || true
        else
            read -t 60 -r -p "Bạn có muốn cài đặt / kết nối Tailscale ngay không? [y/N]: " USER_TS_CHOICE || true
        fi

        case "$USER_TS_CHOICE" in
            [yY][eE][sS]|[yY])
                INSTALL_TS="y"
                ;;
            *)
                INSTALL_TS="n"
                ;;
        esac
    fi

    if [ "$INSTALL_TS" = "y" ]; then
        echo -e "${CYAN}[INFO]${NC} Đang chuẩn bị Tailscale..."

        if [ "$OS" = "Darwin" ]; then
            # Clean up broken /usr/local/bin/tailscale wrapper if present
            if [ -f "/usr/local/bin/tailscale" ]; then
                if ! /usr/local/bin/tailscale version >/dev/null 2>&1; then
                    rm -f "/usr/local/bin/tailscale" 2>/dev/null || sudo rm -f "/usr/local/bin/tailscale" 2>/dev/null || true
                fi
            fi

            # Auto-install Tailscale.app if not installed
            if [ ! -d "/Applications/Tailscale.app" ]; then
                echo -e "${CYAN}[INFO]${NC} Đang tải và cài đặt Tailscale cho macOS..."
                TS_TMP=$(mktemp -d /tmp/tailscale_install.XXXXXX)
                curl -# -fL -o "${TS_TMP}/Tailscale.pkg" "https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg"
                pkgutil --expand-full "${TS_TMP}/Tailscale.pkg" "${TS_TMP}/expanded" 2>/dev/null || true
                if [ -d "${TS_TMP}/expanded/Distribution.pkg/Payload/Tailscale.app" ]; then
                    cp -R "${TS_TMP}/expanded/Distribution.pkg/Payload/Tailscale.app" /Applications/ 2>/dev/null || sudo cp -R "${TS_TMP}/expanded/Distribution.pkg/Payload/Tailscale.app" /Applications/ 2>/dev/null || true
                elif command -v sudo >/dev/null 2>&1; then
                    sudo installer -pkg "${TS_TMP}/Tailscale.pkg" -target / 2>/dev/null || open "${TS_TMP}/Tailscale.pkg"
                else
                    open "${TS_TMP}/Tailscale.pkg"
                fi
                rm -rf "${TS_TMP}"
            fi

            open -a Tailscale 2>/dev/null || true
            echo -e "${GREEN}[✓] Ứng dụng Tailscale đã sẵn sàng trên macOS!${NC}"
            echo -e "${CYAN}[INFO]${NC} Đang mở trang đăng nhập Tailscale trên trình duyệt web..."
            open "https://login.tailscale.com/start" 2>/dev/null || true
            echo -e "${BOLD}Bạn cũng có thể bấm vào biểu tượng Tailscale trên Menu Bar để đăng nhập.${NC}"

        elif [ "$OS" = "Linux" ]; then
            if ! command -v tailscale >/dev/null 2>&1; then
                echo -e "${CYAN}[INFO]${NC} Đang cài đặt Tailscale qua script chính thức..."
                curl -fsSL https://tailscale.com/install.sh | sh
            fi

            if command -v tailscale >/dev/null 2>&1; then
                echo -e "${CYAN}[INFO]${NC} Khởi động xác thực Tailscale..."
                echo -e "${BOLD}Vui lòng mở liên kết xác thực hiển thị dưới đây trên trình duyệt để đăng nhập:${NC}"
                echo ""
                TARGET_USER="${SUDO_USER:-$USER}"
                if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
                    sudo tailscale up --operator="$TARGET_USER" || sudo tailscale up || true
                else
                    tailscale up || true
                fi
            fi

        elif [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
            if ! command -v tailscale >/dev/null 2>&1; then
                if command -v winget.exe >/dev/null 2>&1; then
                    echo -e "${CYAN}[INFO]${NC} Đang cài đặt Tailscale qua winget..."
                    winget.exe install -e --id Tailscale.Tailscale --accept-source-agreements --accept-package-agreements || true
                else
                    echo -e "${CYAN}[INFO]${NC} Đang tải bộ cài Tailscale cho Windows..."
                    curl -L -o /tmp/tailscale-setup.exe "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
                    /tmp/tailscale-setup.exe /quiet || true
                    rm -f /tmp/tailscale-setup.exe
                fi
                if [ -d "/c/Program Files/Tailscale" ]; then
                    export PATH="/c/Program Files/Tailscale:$PATH"
                fi
            fi

            if command -v tailscale >/dev/null 2>&1; then
                echo -e "${CYAN}[INFO]${NC} Khởi động xác thực Tailscale..."
                tailscale up || true
            fi
        fi

        # Check Tailscale IP
        TAILSCALE_IP=""
        if command -v tailscale >/dev/null 2>&1; then
            TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || true)
        fi

        if [ -n "$TAILSCALE_IP" ]; then
            echo ""
            echo -e "${GREEN}[✓] Đã kết nối Tailscale thành công! (IP: ${TAILSCALE_IP})${NC}"
        else
            echo ""
            echo -e "${CYAN}[INFO]${NC} Sau khi hoàn tất đăng nhập Tailscale trên trình duyệt, IP truy cập từ xa sẽ tự động sẵn sàng."
        fi
    fi
fi

# 9. Final Installation Summary
echo -e "\n${GREEN}${BOLD}"
echo "================================================================================"
echo "          BeE PRINTER PLATFORM ĐÃ KHỞI CHẠY THÀNH CÔNG                          "
echo "================================================================================"
echo -e "${NC}"
echo -e "${BOLD}Mở trình duyệt web và truy cập Dashboard tại:${NC}"
echo -e "   • Mạng nội bộ (LAN):      ${CYAN}${BOLD}http://${SERVER_IP}:${BEE_PORT}${NC}"
if [ -n "$TAILSCALE_IP" ]; then
    echo -e "   • Mạng từ xa (Tailscale): ${CYAN}${BOLD}http://${TAILSCALE_IP}:${BEE_PORT}${NC}"
else
    echo -e "   • Truy cập từ xa (4G):    ${YELLOW}Chưa cấu hình${NC} (Lệnh cài đặt: curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up)"
fi
if [ "$SERVER_IP" != "localhost" ]; then
    echo -e "   • Cục bộ (Localhost):     ${CYAN}http://localhost:${BEE_PORT}${NC}"
fi
echo ""
echo -e "${BOLD}Lệnh quản lý thông dụng:${NC}"
echo -e "   • Xem log hệ thống:       ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
echo -e "   • Khởi động lại:          ${YELLOW}${COMPOSE_CMD} restart${NC}"
echo -e "   • Dừng hệ thống:          ${YELLOW}${COMPOSE_CMD} down${NC}"
echo -e "   • Cập nhật bản mới nhất:  ${YELLOW}${COMPOSE_CMD} pull && ${COMPOSE_CMD} up -d${NC}"
echo ""
echo -e "${BLUE}Hỗ trợ kỹ thuật & Cộng đồng: https://beestemsolutions.com.vn${NC}"
echo "================================================================================"
