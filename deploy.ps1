#!/usr/bin/env pwsh
# ============================================================
# GeoMesh — Deploy & Update Script (No Docker untuk App)
# ============================================================
# Usage: .\deploy.ps1 [command]
#   .\deploy.ps1 start      # Start pertama kali
#   .\deploy.ps1 update     # Update setelah ada perubahan kode
#   .\deploy.ps1 logs       # Lihat log
#   .\deploy.ps1 stop       # Stop semua
#   .\deploy.ps1 infra      # Hanya jalankan infrastruktur Docker

param([string]$Command = "help")

$ErrorActionPreference = "Stop"

function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" -ForegroundColor Cyan }
function Ok($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }

switch ($Command) {

  # ─── START: Pertama kali atau setelah mesin restart ──────────────────
  "start" {
    Log "Memulai infrastruktur Docker (DB, Redis, EMQX, Keycloak)..."
    docker-compose -f docker-compose.infra.yml up -d
    Start-Sleep -Seconds 5

    Log "Membuat folder logs..."
    New-Item -ItemType Directory -Force -Path "logs" | Out-Null

    Log "Install dependencies..."
    npm ci

    Log "Push database schema (Prisma)..."
    Set-Location apps/backend
    npx prisma db push --schema=prisma/schema.prisma
    Set-Location ../..

    Log "Build backend (NestJS)..."
    npm run build --workspace=apps/backend

    Log "Build frontend (Next.js)..."
    npm run build --workspace=apps/frontend

    Log "Start PM2 processes..."
    # Update ecosystem untuk menggunakan dist/main.js
    $ecosystemContent = Get-Content ecosystem.config.js -Raw
    $ecosystemContent = $ecosystemContent -replace "script: '../../node_modules/.bin/ts-node',\r?\n\s+args: '-r tsconfig-paths/register src/main.ts',", "script: 'dist/main.js',"
    $ecosystemContent | Set-Content ecosystem.config.js

    npx pm2 start ecosystem.config.js
    npx pm2 save

    Ok "GeoMesh berhasil dijalankan!"
    Ok "Backend : http://localhost:4000/api"
    Ok "Frontend: http://localhost:3300"
    Ok "Swagger : http://localhost:4000/api/docs"
  }

  # ─── UPDATE: Setelah ada perubahan kode ──────────────────────────────
  "update" {
    Log "Pulling latest code (jika pakai git)..."
    # git pull  # Uncomment jika pakai Git

    Log "Install dependencies baru (jika ada)..."
    npm ci

    Log "Push database schema (jika ada perubahan Prisma)..."
    Set-Location apps/backend
    npx prisma db push --schema=prisma/schema.prisma
    Set-Location ../..

    Log "Build backend..."
    npm run build --workspace=apps/backend

    Log "Build frontend..."
    npm run build --workspace=apps/frontend

    Log "Reload PM2 (zero-downtime)..."
    npx pm2 reload all

    Ok "Update selesai! Perubahan sudah aktif."
  }

  # ─── DEV: Mode development dengan hot reload ─────────────────────────
  "dev" {
    Log "Memulai infrastruktur Docker..."
    docker-compose -f docker-compose.infra.yml up -d
    Start-Sleep -Seconds 3

    Log "Push database schema..."
    Set-Location apps/backend
    npx prisma db push --schema=prisma/schema.prisma
    Set-Location ../..

    Log "Starting dev servers dengan hot reload..."
    Log "Backend  -> http://localhost:4000"
    Log "Frontend -> http://localhost:3300"
    Log "Ctrl+C untuk stop"

    # Jalankan backend dan frontend secara paralel
    $backend = Start-Process -PassThru -NoNewWindow powershell -ArgumentList "-Command", "cd apps/backend; npx nest start --watch"
    $frontend = Start-Process -PassThru -NoNewWindow powershell -ArgumentList "-Command", "cd apps/frontend; npx next dev -p 3300"

    Write-Host ""
    Write-Host "Dev servers berjalan. Tekan Enter untuk stop..." -ForegroundColor Yellow
    Read-Host

    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    Ok "Dev servers stopped."
  }

  # ─── LOGS ─────────────────────────────────────────────────────────────
  "logs" {
    npx pm2 logs --lines 100
  }

  # ─── STOP ─────────────────────────────────────────────────────────────
  "stop" {
    Log "Menghentikan PM2 processes..."
    npx pm2 stop all
    Log "Menghentikan infrastruktur Docker..."
    docker-compose -f docker-compose.infra.yml stop
    Ok "Semua services dihentikan."
  }

  # ─── INFRA: Hanya jalankan Docker infra ──────────────────────────────
  "infra" {
    Log "Memulai infrastruktur Docker saja..."
    docker-compose -f docker-compose.infra.yml up -d
    Ok "Infrastruktur berjalan:"
    Ok "  PostgreSQL : localhost:5432"
    Ok "  Redis      : localhost:6379"
    Ok "  EMQX MQTT  : localhost:1883"
    Ok "  EMQX Dashboard: http://localhost:18083"
    Ok "  Keycloak   : http://localhost:8080"
  }

  # ─── STATUS ───────────────────────────────────────────────────────────
  "status" {
    Write-Host "`n=== PM2 Processes ===" -ForegroundColor Yellow
    npx pm2 list
    Write-Host "`n=== Docker Infra ===" -ForegroundColor Yellow
    docker-compose -f docker-compose.infra.yml ps
  }

  # ─── HELP ─────────────────────────────────────────────────────────────
  default {
    Write-Host @"

GeoMesh Deploy Script (Non-Docker Mode)
========================================

COMMANDS:
  .\deploy.ps1 start     Jalankan pertama kali (build + start PM2)
  .\deploy.ps1 update    Update setelah perubahan kode (build + reload)
  .\deploy.ps1 dev       Mode development dengan hot-reload
  .\deploy.ps1 logs      Lihat log real-time
  .\deploy.ps1 stop      Stop semua services
  .\deploy.ps1 infra     Hanya jalankan infrastruktur Docker
  .\deploy.ps1 status    Lihat status PM2 dan Docker

WORKFLOW DEVELOPMENT:
  1. .\deploy.ps1 dev     # Hot reload - perubahan langsung
  
WORKFLOW PRODUCTION:
  1. .\deploy.ps1 start   # Pertama kali
  2. edit kode...
  3. .\deploy.ps1 update  # Setelah update kode

"@ -ForegroundColor White
  }
}
