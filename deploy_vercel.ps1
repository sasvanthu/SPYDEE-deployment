# SPYDEE Vercel Frontend Deployment Script
# Bundles all 16 National Cases and 25 Datasets for instant, zero-database Vercel Showcase deployment.

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SPYDEE Frontend Deployment to Vercel (Showcase Mode)  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Refreshing offline demo dataset snapshot..." -ForegroundColor Yellow
if (Test-Path "$root\scripts\export_vercel_demo_data.py") {
    python "$root\scripts\export_vercel_demo_data.py"
}

Write-Host "`n[2/3] Building production frontend bundle..." -ForegroundColor Yellow
Set-Location "$root\apps\web"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Production build failed. Please resolve build errors above." -ForegroundColor Red
    Set-Location $root
    exit 1
}

Write-Host "`n[3/3] Ready for Vercel Deployment!" -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host "Option 1: Deploy with Vercel CLI (Now)" -ForegroundColor Yellow
Write-Host "  Run: npx vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Deploy via GitHub (Recommended)" -ForegroundColor Yellow
Write-Host "  Push this repository to GitHub and import it into Vercel:" -ForegroundColor White
Write-Host "  - Framework: Vite" -ForegroundColor Gray
Write-Host "  - Root Directory: apps/web (or leave root with vercel.json)" -ForegroundColor Gray
Write-Host "  - Build Command: npm run build" -ForegroundColor Gray
Write-Host "  - Output Directory: dist" -ForegroundColor Gray
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

$choice = Read-Host "`nDo you want to run 'npx vercel' right now? (y/N)"
if ($choice -eq 'y' -or $choice -eq 'Y') {
    Write-Host "`nLaunching Vercel deployment CLI..." -ForegroundColor Cyan
    npx vercel
}

Set-Location $root
