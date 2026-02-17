# build_cws.ps1 — Package AmoNexus for Chrome Web Store
# Usage: .\build_cws.ps1

$ErrorActionPreference = "Stop"

$version = (Get-Content manifest.json | ConvertFrom-Json).version
$outDir = "dist"
$zipName = "AmoNexus_v${version}_CWS.zip"
$zipPath = Join-Path $outDir $zipName

# Clean previous build
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

# Folders/files to EXCLUDE from CWS package
$excludes = @(
    '.git',
    '.gitignore',
    '.github',
    '.agent',
    '.gemini',
    '.claude',
    '.antigravityignore',
    '.editorconfig',
    'node_modules',
    'supabase',
    'spec',
    'ideas',
    'docs',
    'tools',
    'branding',
    'neural-memory-main',
    'ATOM_Web',
    'amo-lofi-web',
    'backup_*',
    'dist',
    'build',
    'build_cws.ps1',
    '*.md',
    '*.log',
    '*.tmp',
    '*.temp',
    '*.py',
    '*.txt',
    'package.json',
    'package-lock.json'
)

Write-Host "Building AmoNexus v$version for CWS..." -ForegroundColor Cyan

# Create temp staging directory
$staging = Join-Path $outDir "_staging"
New-Item -ItemType Directory -Path $staging | Out-Null

# Copy all files except excluded
$allItems = Get-ChildItem -Path . -Force | Where-Object {
    $name = $_.Name
    -not ($excludes | Where-Object { $name -like $_ })
}

foreach ($item in $allItems) {
    if ($item.PSIsContainer) {
        Copy-Item $item.FullName -Destination (Join-Path $staging $item.Name) -Recurse -Force
    }
    else {
        Copy-Item $item.FullName -Destination $staging -Force
    }
}

# Verify config/supabase_config.js exists (required for extension to work)
$configFile = Join-Path $staging "config\supabase_config.js"
if (-not (Test-Path $configFile)) {
    Write-Host "WARNING: config/supabase_config.js not found in package!" -ForegroundColor Yellow
    Write-Host "  CWS build needs this file. Make sure it exists." -ForegroundColor Yellow
}

# Create ZIP
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

# Cleanup staging
Remove-Item $staging -Recurse -Force

# Report
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "Done! Package: $zipPath ($size MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Excluded from package:" -ForegroundColor DarkGray
$excludes | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
Write-Host ""
Write-Host "Next: Upload $zipPath to Chrome Web Store Developer Dashboard" -ForegroundColor Cyan
