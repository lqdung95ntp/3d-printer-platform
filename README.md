# BeE Printer Platform (3D Printer Platform)

> **Trung tâm điều hành và quản lý máy in 3D đa nền tảng (Bambu Lab, Klipper, Prusa & Elegoo).**  
> *Phát triển bởi [BeE STEM Solutions](https://beestemsolutions.com.vn)*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker Support](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Multi-Arch](https://img.shields.io/badge/Platform-x86__64%20%7C%20ARM64%20(Pi%204%2F5)-success)](#)

---

## Tính Năng Nổi Bật

- **Quản lý đa hãng máy in**: Điều khiển tập trung Bambu Lab (X1, P1, A1, A1 mini), Klipper / Moonraker (Voron, Creality K1, Ender, Neptune...), Prusa và Elegoo.
- **Tự động nhận diện mạng Moonraker**: Tự động phục hồi kết nối khi modem Wi-Fi đổi địa chỉ IP (DHCP lease).
- **Auto Swap PEI (In liên tục 24/7)**: Tự động đợi bàn in nguội về nhiệt độ an toàn (38°C), kích hoạt gạt tấm PEI và tự động kéo file in tiếp theo từ hàng đợi.
- **Quản lý nguồn thông minh (Smart Power)**: Tự động ngắt điện qua Smart Plug sau 30 phút rảnh rỗi và đánh thức trước 3 phút.
- **Bỏ qua chi tiết lỗi (Skip Objects)**: Xem trực quan 2D Vector Bed, cho phép click bỏ qua chi tiết bị bung chân/hỏng trên bàn in nhiều món mà không làm hỏng cả mẻ in.
- **Quản lý cuộn nhựa (Spoolman)**: Theo dõi lượng nhựa tiêu hao, màu sắc và tự động map cuộn nhựa trước khi in.
- **Camera giám sát độ trễ thấp**: Hỗ trợ WebRTC, go2rtc và MJPEG xem mượt mà trên điện thoại.
- **Nạp Firmware an toàn qua Web UI**: Tải trực tiếp file `.bin`/`.zip` lên thẻ nhớ máy in qua giao thức FTPS nội bộ hoặc Moonraker API.

---

## Cài Đặt Nhanh (1-Command Quick Start)

### Dành cho Linux, macOS & Raspberry Pi OS (Terminal)
Mở Terminal và dán lệnh sau:
```bash
curl -fsSL https://raw.githubusercontent.com/lqdung95ntp/3d-printer-platform/main/install.sh | bash
```

### Dành cho Windows 10 / 11 (PowerShell)
Mở PowerShell và dán lệnh sau:
```powershell
irm https://raw.githubusercontent.com/lqdung95ntp/3d-printer-platform/main/install.ps1 | iex
```

Sau khi hoàn tất, mở trình duyệt web và truy cập:
**`http://localhost:8000`** (hoặc `http://<IP-của-máy>:8000`)

---

## Cài Đặt Bằng Docker Compose

Nếu bạn muốn tự clone và quản lý bằng Docker:

```bash
# 1. Clone repo
git clone https://github.com/lqdung95ntp/3d-printer-platform.git
cd 3d-printer-platform

# 2. Khởi tạo file môi trường
cp .env.example .env

# 3. Khởi động hệ thống
docker compose up -d

# 4. Xem log hoạt động
docker compose logs -f
```

---

## Cấu Hình (.env)

Mặc định hệ thống hoạt động ngay mà không cần cấu hình. Nếu cần đổi cổng hoặc đường dẫn lưu dữ liệu, chỉnh sửa file `.env`:

```env
# Cổng truy cập Web Dashboard (Mặc định: 8000)
BEE_PORT=8000

# Múi giờ
TZ=Asia/Ho_Chi_Minh

# Thư mục lưu trữ database và file in
DATA_PATH=./data
```

---

## Quản Lý Hệ Thống

| Thao tác | Câu lệnh |
| :--- | :--- |
| **Xem log hoạt động** | `docker compose logs -f` |
| **Khởi động lại** | `docker compose restart` |
| **Dừng hệ thống** | `docker compose down` |
| **Cập nhật phiên bản mới** | `docker compose pull && docker compose up -d` |

---

## Giấy Phép & Bản Quyền

- **Core Platform**: Phát hành theo giấy phép mã nguồn mở **AGPLv3** (kế thừa từ dự án Printbuddy).
- **Pro Sidecar Extension**: Bản quyền thương mại thuộc về **BeE STEM Solutions**. Cung cấp 7 ngày dùng thử miễn phí đầy đủ tính năng Auto Swap PEI và Smart Power.

---

## Hỗ Trợ & Cộng Đồng

- **Trang chủ & Cửa hàng Kit**: [beestemsolutions.com.vn](https://beestemsolutions.com.vn)
- **Báo lỗi & Góp ý tính năng**: [GitHub Issues](https://github.com/lqdung95ntp/3d-printer-platform/issues)
