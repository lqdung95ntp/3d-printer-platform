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
    Write-Host "Dang tai ma nguon BeE Printer Platform tu GitHub..." -ForegroundColor Cyan
    if (Get-Command git -ErrorAction SilentlyContinue) {
        git clone https://github.com/lqdung95ntp/3d-printer-platform.git $installDir
        Set-Location $installDir
    } else {
        $zipUrl = "https://github.com/lqdung95ntp/3d-printer-platform/archive/refs/heads/main.zip"
        $zipFile = "$env:TEMP\bee_repo.zip"
        $extractDir = "$env:TEMP\bee_extracted"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
        Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
        Move-Item -Path "$extractDir\3d-printer-platform-main" -Destination $installDir
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        Set-Location $installDir
    }
    Write-Host "[OK] Da chuan bi ma nguon tai thu muc hien tai." -ForegroundColor Green
}

# 5. Setup Directories & .env
New-Item -ItemType Directory -Force -Path "data", "logs" | Out-Null

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
Write-Host "Dang khoi dong he thong BeE Printer Platform..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "          BeE PRINTER PLATFORM DA KHOI CHAY THANH CONG                          " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "Mo trinh duyet web va truy cap Dashboard tai:"
Write-Host "   URL: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lenh quan ly thong dung:"
Write-Host "   - Xem log:       docker compose logs -f"
Write-Host "   - Khoi dong lai: docker compose restart"
Write-Host "   - Dung he thong: docker compose down"
Write-Host "   - Cap nhat:      docker compose pull && docker compose up -d"
Write-Host ""
Write-Host "Ho tro ky thuat & Cong dong: https://beestemsolutions.com.vn" -ForegroundColor Blue
Write-Host "================================================================================"

