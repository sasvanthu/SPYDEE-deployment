# SPYDEE Database Switcher (PowerShell)
# Allows switching active configuration between Local PostgreSQL and Supabase Cloud.
param (
    [ValidateSet("local", "supabase", "status", "prune", "revert")]
    [string]$Target = "status"
)

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

function Get-CurrentDb {
    if (Test-Path "$root\.env") {
        $dbLine = Get-Content "$root\.env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
        if ($dbLine -and ($dbLine -notmatch "localhost") -and ($dbLine -notmatch "127\.0\.0\.1")) {
            return "Supabase (Cloud)"
        } elseif ($dbLine) {
            return "Local PostgreSQL (localhost:5432)"
        }
    }
    return "Unknown / Not Configured"
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   SPYDEE Database Environment Switcher  " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if ($Target -eq "status") {
    $current = Get-CurrentDb
    Write-Host "Current Active Database: " -NoNewline
    Write-Host $current -ForegroundColor Green
    Write-Host "`nUsage:" -ForegroundColor Yellow
    Write-Host "  .\switch-db.ps1 local     # Switch to Local PostgreSQL (no storage limits)"
    Write-Host "  .\switch-db.ps1 supabase  # Switch to Supabase Cloud"
    Write-Host "  .\switch-db.ps1 prune     # Prune Supabase: drop bulk raw tables (drop to ~15MB)"
    Write-Host "  .\switch-db.ps1 revert    # Switch to local and wipe Supabase data to 0MB"
    Write-Host "  .\switch-db.ps1 status    # Show current active DB"
    exit 0
}

if ($Target -eq "local") {
    if (-not (Test-Path "$root\.env.local")) {
        Write-Host "Error: .env.local not found!" -ForegroundColor Red
        exit 1
    }
    Copy-Item "$root\.env.local" "$root\.env" -Force
    Write-Host "Switched active configuration to: " -NoNewline
    Write-Host "Local PostgreSQL" -ForegroundColor Green
    Write-Host "DATABASE_URL -> localhost:5432/spydee" -ForegroundColor Gray
} elseif ($Target -eq "supabase") {
    if (-not (Test-Path "$root\.env.supabase")) {
        Write-Host "Error: .env.supabase not found!" -ForegroundColor Red
        exit 1
    }
    Copy-Item "$root\.env.supabase" "$root\.env" -Force
    Write-Host "Switched active configuration to: " -NoNewline
    Write-Host "Supabase Cloud Database" -ForegroundColor Green
    Write-Host "DATABASE_URL -> db.limyyynvqzitwwkygylp.supabase.co" -ForegroundColor Gray
} elseif ($Target -eq "prune") {
    Write-Host "Pruning Supabase database storage (dropping bulk raw logs)..." -ForegroundColor Yellow
    python "$root\scripts\prune_supabase_storage.py"
} elseif ($Target -eq "revert") {
    Write-Host "1. Switching active configuration back to Local PostgreSQL..." -ForegroundColor Yellow
    if (Test-Path "$root\.env.local") {
        Copy-Item "$root\.env.local" "$root\.env" -Force
        Write-Host "   [OK] Active config set to Local PostgreSQL." -ForegroundColor Green
    }
    Write-Host "2. Wiping Supabase Cloud tables back to clean slate..." -ForegroundColor Yellow
    python "$root\scripts\prune_supabase_storage.py" --revert-all
}

Write-Host "`nNote: If backend services are currently running, restart them to apply the new database connection." -ForegroundColor Yellow
