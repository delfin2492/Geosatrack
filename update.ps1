# Self-Contained Automation Script for Local Geomesh Updates

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "🔄 STARTING GEOMESH LOCAL WORKSPACE UPDATE..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Pull changes
Write-Host "`n1. Pulling latest code changes from GitHub..." -ForegroundColor Yellow
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Git pull failed! Please check your internet connection or git status."
    exit 1
}

# 2. Install dependencies
Write-Host "`n2. Installing npm packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Dependency installation failed!"
    exit 1
}

# 3. Synchronize Prisma Schema
Write-Host "`n3. Syncing database schema with Prisma..." -ForegroundColor Yellow
npx prisma db push --schema=apps/backend/prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Warning: Prisma sync failed. Checking if Docker database is active..." -ForegroundColor Yellow
    docker compose up -d geomesh-db
    Start-Sleep -Seconds 3
    npx prisma db push --schema=apps/backend/prisma/schema.prisma
}

# 4. Initialize TimescaleDB Hypertable
Write-Host "`n4. Ensuring TimescaleDB Hypertable is active..." -ForegroundColor Yellow
try {
    if (Test-Path "apps/backend/prisma/timescaledb.sql") {
        Get-Content apps/backend/prisma/timescaledb.sql | docker exec -i geomesh-db psql -U geouser -d geomesh
        Write-Host "✅ Hypertable SQL script applied successfully." -ForegroundColor Green
    } else {
        Write-Host "⚠️ timescaledb.sql script not found. Skipping." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error executing TimescaleDB query. Make sure geomesh-db is running." -ForegroundColor Red
}

# 5. Database Seeding
Write-Host "`n5. Seeding default database data..." -ForegroundColor Yellow
cd apps/backend
npx prisma db seed
cd ../..

# 6. Verify and Build Workspaces
Write-Host "`n6. Verifying build status for NestJS and Next.js..." -ForegroundColor Yellow
npm run build:all
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=========================================================" -ForegroundColor Green
    Write-Host "✅ WORKSPACE UPDATE SUCCESSFUL!" -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "Run these commands in separate terminal sessions to start:" -ForegroundColor Green
    Write-Host " 👉 npm run dev:backend" -ForegroundColor White
    Write-Host " 👉 npm run dev:frontend" -ForegroundColor White
} else {
    Write-Host "`n❌ Update finished, but build failed. Please check error logs." -ForegroundColor Red
}
