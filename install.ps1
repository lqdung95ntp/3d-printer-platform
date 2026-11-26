# ==============================================================================
# BeE Printer Platform - Official 1-Command Windows PowerShell Installer
# Supported OS: Windows 10, Windows 11 (PowerShell 5.1+)
# Website: https://beestemsolutions.com.vn
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "          BeE PRINTER PLATFORM - TRUNG TÂM QUẢN LÝ MÁY IN 3D                    " -ForegroundColor Cyan
Write-Host "                     Powered by BeE STEM Solutions                              " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check and Auto-Install Docker Desktop on Windows
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Docker chua duoc cai dat tren may nay." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Dang tu dong cai dat Docker Desktop qua winget..." -ForegroundColor Cyan
        try {
            winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
            Write-Host "[OK] Da cai dat Docker Desktop thanh cong!" -ForegroundColor Green
        } catch {
            Write-Host "[!] Winget gap su co, chuyen sang tai truc tiep tu may chu Docker..." -ForegroundColor Yellow
        }
    }
    
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        if (-not (Test-Path $dockerPath)) {
            Write-Host "Dang tai bo cai dat Docker Desktop Installer.exe..." -ForegroundColor Cyan
            $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
            Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $installerPath
            Write-Host "Dang tien hanh cai dat Docker Desktop (vui long cho trong giay lat)..." -ForegroundColor Cyan
            Start-Process -FilePath $installerPath -ArgumentList "install", "--quiet" -Wait
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Cai dat Docker Desktop hoan tat!" -ForegroundColor Green
        }
    }
}

# 2. Check and start Docker Desktop if not running
$dockerRunning = $false
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Host "Dang khoi dong Docker Desktop..." -ForegroundColor Cyan
    $dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
    }
    Write-Host -NoNewline "Dang cho Docker daemon san sang"
    for ($i = 0; $i -lt 35; $i++) {
        Start-Sleep -Seconds 3
        try {
            $null = docker info 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "[OK] Docker daemon da san sang!" -ForegroundColor Green
                $dockerRunning = $true
                break
            }
        } catch {}
        Write-Host -NoNewline "."
    }
    if (-not $dockerRunning) {
        Write-Host ""
        Write-Host "[!] Docker Desktop dang khoi tao hoac yeu cau khoi dong lai may de bat WSL2." -ForegroundColor Yellow
        Write-Host "Vui long mo Docker Desktop tu Start Menu, sau do chay lai script nay." -ForegroundColor Yellow
        exit 0
    }
}

# 3. Check Docker Compose
$composeCmd = "docker compose"
try {
    $null = docker compose version 2>$null
} catch {
    Write-Host "[X] Khong tim thay Docker Compose. Vui long cap nhat Docker Desktop." -ForegroundColor Red
    exit 1
}

# 4. Check and Download Project Files if running from an empty directory
if (-not (Test-Path "docker-compose.yml")) {
    $installDir = "3d-printer-platform"
    if (Test-Path $installDir) {
        Set-Location $installDir
    } else {
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
        Set-Location $installDir
    }
}

if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Dang tai ma nguon BeE Printer Platform tu GitHub..." -ForegroundColor Cyan
    if (Get-Command git -ErrorAction SilentlyContinue) {
        if (-not (Test-Path ".git")) {
            try {
                git clone https://github.com/lqdung95ntp/3d-printer-platform.git . 2>$null
            } catch {
                # Fallback if directory not empty
            }
            if (-not (Test-Path "docker-compose.yml")) {
                git init
                git checkout -B main 2>$null
                git remote add origin https://github.com/lqdung95ntp/3d-printer-platform.git 2>$null
                git fetch origin main --depth=1
                git checkout -f main
            }
        } else {
            git pull origin main
        }
    } else {
        $zipUrl = "https://github.com/lqdung95ntp/3d-printer-platform/archive/refs/heads/main.zip"
        $zipFile = "$env:TEMP\bee_repo.zip"
        $extractDir = "$env:TEMP\bee_extracted"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
        Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
        $innerFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
        if ($innerFolder) {
            Copy-Item -Path "$($innerFolder.FullName)\*" -Destination . -Recurse -Force
        }
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Dang tai truc tiep docker-compose.yml tu GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/lqdung95ntp/3d-printer-platform/main/docker-compose.yml" -OutFile "docker-compose.yml" -ErrorAction SilentlyContinue
}

Write-Host "[OK] Da chuan bi ma nguon tai: $(Get-Location)" -ForegroundColor Green

# 5. Setup Directories & .env
New-Item -ItemType Directory -Force -Path "data/core", "data/pro", "logs" | Out-Null

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        @"
BEE_PORT=8000
TZ=Asia/Ho_Chi_Minh
DATA_PATH=./data
"@ | Out-File -FilePath ".env" -Encoding utf8
    }
    Write-Host "[OK] Da tao file cau hinh .env mac dinh (Port: 8000)." -ForegroundColor Green
}

# 6. Launch System
Write-Host "Dang tai container images tu GitHub Packages..." -ForegroundColor Cyan
docker compose pull
Write-Host "Dang khoi dong he thong BeE Printer Platform..." -ForegroundColor Cyan
docker compose up -d

# 7. Detect Local / LAN IP Address
$serverIp = "localhost"
try {
    $foundIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
        $_.IPAddress -notmatch "^127\." -and 
        $_.IPAddress -notmatch "^169\.254\." -and 
        $_.IPAddress -notmatch "^172\.(1[6-9]|2[0-9]|3[0-1])\." -and 
        $_.InterfaceAlias -notmatch "vEthernet|Loopback|Docker"
    } | Select-Object -First 1).IPAddress
    if ($foundIp) { $serverIp = $foundIp }
} catch {}

# Read port from .env
$beePort = "8000"
if (Test-Path ".env") {
    $portLine = Get-Content ".env" | Where-Object { $_ -match "^BEE_PORT=(\d+)" } | Select-Object -First 1
    if ($portLine -match "^BEE_PORT=(\d+)") {
        $beePort = $matches[1]
    }
}

# 8. Optional Tailscale Remote Access
$tailscaleIp = ""
$tsCmd = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $tsCmd) {
    $tsDefaultDir = "${env:ProgramFiles}\Tailscale"
    if (Test-Path "$tsDefaultDir\tailscale.exe") {
        $env:PATH = "$tsDefaultDir;$env:PATH"
        $tsCmd = Get-Command tailscale -ErrorAction SilentlyContinue
    }
}

if ($tsCmd) {
    try {
        $tsStatus = & tailscale status 2>$null
        if ($tsStatus -and ($tsStatus -notmatch "NeedsLogin|Logged out|stopped")) {
            $tailscaleIp = (& tailscale ip -4 2>$null).Trim()
        }
    } catch {}
}

if ($tailscaleIp) {
    Write-Host "[✓] Da phat hien ket noi Tailscale (IP: $tailscaleIp)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "CAU HINH TRUY CAP TU XA NGOAI MANG LAN (TAILSCALE)" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "Tailscale cho phep ban theo doi va dieu khien may in tu 4G / mang ngoai an toan."
    Write-Host "Dang nhap nhanh bang tai khoan Google, Apple, Microsoft hoac GitHub."
    Write-Host ""
    
    $choice = Read-Host "Ban co muon cai dat / ket noi Tailscale ngay khong? [y/N]"
    if ($choice -match "^[yY]") {
        Write-Host "Dang chuan bi Tailscale..." -ForegroundColor Cyan
        if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
            if (Get-Command winget -ErrorAction SilentlyContinue) {
                Write-Host "Dang cai dat Tailscale qua winget..." -ForegroundColor Cyan
                try {
                    winget install -e --id Tailscale.Tailscale --accept-source-agreements --accept-package-agreements
                } catch {}
            }
            if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
                $installerPath = "$env:TEMP\tailscale-setup.exe"
                Write-Host "Dang tai bo cai dat Tailscale..." -ForegroundColor Cyan
                Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" -OutFile $installerPath
                Start-Process -FilePath $installerPath -ArgumentList "/quiet" -Wait
                Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
            }
            if (Test-Path "${env:ProgramFiles}\Tailscale\tailscale.exe") {
                $env:PATH = "${env:ProgramFiles}\Tailscale;$env:PATH"
            }
        }

        if (Get-Command tailscale -ErrorAction SilentlyContinue) {
            Write-Host "Khoi dong xac thuc Tailscale..." -ForegroundColor Cyan
            Write-Host "Vui long mo lien ket xac thuc hien thi duoi day tren trinh duyet de dang nhap:"
            & tailscale up
            $tailscaleIp = (& tailscale ip -4 2>$null).Trim()
            if ($tailscaleIp) {
                Write-Host ""
                Write-Host "[OK] Da ket noi Tailscale thanh cong! (IP: $tailscaleIp)" -ForegroundColor Green
            } else {
                Write-Host "[INFO] Sau khi hoan tat dang nhap tren trinh duyet, IP truy cap tu xa se tu dong san sang." -ForegroundColor Cyan
            }
        } else {
            Start-Process "https://login.tailscale.com/start" -ErrorAction SilentlyContinue
            Write-Host "[INFO] Vui long hoan tat cai dat va dang nhap Tailscale tu: https://tailscale.com/download" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "          BeE PRINTER PLATFORM DA KHOI CHAY THANH CONG                          " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "Mo trinh duyet web va truy cap Dashboard tai:"
Write-Host "   - Mang noi bo (LAN):      http://${serverIp}:${beePort}" -ForegroundColor Cyan
if ($tailscaleIp) {
    Write-Host "   - Mang tu xa (Tailscale): http://${tailscaleIp}:${beePort}" -ForegroundColor Cyan
} else {
    Write-Host "   - Truy cap tu xa (4G):    Chua cau hinh (Chay 'tailscale up' sau khi cai Tailscale)" -ForegroundColor Yellow
}
if ($serverIp -ne "localhost") {
    Write-Host "   - Cuc bo (Localhost):     http://localhost:${beePort}" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Lenh quan ly thong dung:"
Write-Host "   - Xem log:       docker compose logs -f"
Write-Host "   - Khoi dong lai: docker compose restart"
Write-Host "   - Dung he thong: docker compose down"
Write-Host "   - Cap nhat:      docker compose pull && docker compose up -d"
Write-Host ""
Write-Host "Ho tro ky thuat & Cong dong: https://beestemsolutions.com.vn" -ForegroundColor Blue
Write-Host "================================================================================"

