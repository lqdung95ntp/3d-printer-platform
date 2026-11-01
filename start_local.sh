#!/usr/bin/env bash
# ==============================================================================
# BeE Printer Platform - Local Development Startup Script
# Tự động giải phóng cổng 8000 & 5173, khởi chạy Backend FastAPI và Frontend Vite.
# ==============================================================================
set -e

# ANSI Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Xác định chính xác thư mục gốc ROOT_DIR bất kể chạy trực tiếp hay qua symlink
TARGET_FILE="${BASH_SOURCE[0]}"
while [ -L "$TARGET_FILE" ]; do
    TARGET_DIR="$(cd -P "$(dirname "$TARGET_FILE")" && pwd)"
    TARGET_FILE="$(readlink "$TARGET_FILE")"
    [[ "$TARGET_FILE" != /* ]] && TARGET_FILE="$TARGET_DIR/$TARGET_FILE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$TARGET_FILE")" && pwd)"

if [ -d "$SCRIPT_DIR/core" ]; then
    ROOT_DIR="$SCRIPT_DIR"
else
    ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

CORE_DIR="$ROOT_DIR/core"
FRONTEND_DIR="$CORE_DIR/frontend"

echo -e "${CYAN}${BOLD}"
echo "================================================================================"
echo "          KHỞI ĐỘNG MÔI TRƯỜNG LOCAL - 3D PRINTER PLATFORM                      "
echo "                     BeE STEM Solutions                                         "
echo "================================================================================"
echo -e "${NC}"

# Hàm kiểm tra và giải phóng cổng
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  Port ${port} đang bị chiếm bởi tiến trình (PID: ${pids}). Đang giải phóng...${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Đã giải phóng port ${port}.${NC}"
    else
        echo -e "${GREEN}✅ Port ${port} sẵn sàng.${NC}"
    fi
}

# 1. Giải phóng các port 8000 (Backend) và 5173 (Frontend)
echo -e "${BLUE}${BOLD}[1/3] Kiểm tra & Giải phóng xung đột cổng mạng...${NC}"
kill_port 8000
kill_port 5173
echo ""

# 2. Kiểm tra môi trường Python
echo -e "${BLUE}${BOLD}[2/3] Kiểm tra môi trường Backend...${NC}"
PYTHON_BIN=""
if [ -f "$CORE_DIR/venv/bin/python" ]; then
    PYTHON_BIN="$CORE_DIR/venv/bin/python"
elif [ -f "$ROOT_DIR/venv/bin/python" ]; then
    PYTHON_BIN="$ROOT_DIR/venv/bin/python"
else
    PYTHON_BIN="$(which python3)"
fi
echo -e "Sử dụng Python: ${CYAN}${PYTHON_BIN}${NC}"

# 3. Dọn dẹp an toàn khi người dùng bấm Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}🛑 Đang dừng toàn bộ Backend & Frontend...${NC}"
    # Hủy trap để tránh lặp vô tận
    trap - SIGINT SIGTERM EXIT
    kill $(jobs -p) 2>/dev/null || true
    pkill -P $$ 2>/dev/null || true
    kill_port 8000
    kill_port 5173
    echo -e "${GREEN}✅ Đã tắt toàn bộ dịch vụ local thành công!${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Khởi động Backend FastAPI
echo ""
echo -e "${BLUE}${BOLD}[3/3] Khởi chạy dịch vụ...${NC}"
echo -e "${GREEN}🚀 Đang khởi động Backend FastAPI (Port 8000)...${NC}"
cd "$CORE_DIR"
"$PYTHON_BIN" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Đợi backend mở port
sleep 2

# 5. Khởi động Frontend Vite
echo -e "${GREEN}⚡ Đang khởi động Frontend Vite Dev Server (Port 5173)...${NC}"
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}${BOLD}================================================================================"
echo "✨ TOÀN BỘ HỆ THỐNG ĐÃ SẴN SÀNG:"
echo "👉 Frontend (Hot Reload): http://localhost:5173"
echo "👉 Backend API & Static:  http://localhost:8000"
echo "👉 API Swagger Docs:      http://localhost:8000/docs"
echo "👉 Nhấn Ctrl + C để dừng toàn bộ server và giải phóng port bất cứ lúc nào."
echo "================================================================================${NC}"
echo ""

# Chờ tiến trình nền
wait

