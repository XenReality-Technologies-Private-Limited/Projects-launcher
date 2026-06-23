# build-all.ps1
# Builds all PoC repos and the main launcher, assembles into _deploy/
# Run from the New_POC_Website directory before building the Docker image.

$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pocs  = Split-Path -Parent $root   # parent of New_POC_Website
$out   = Join-Path $root '_deploy'

# Clean output directory
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

function Build-PoC {
  param([string]$Dir, [string]$Subpath)
  Write-Host "Building $Subpath from $Dir ..." -ForegroundColor Cyan
  Push-Location $Dir
  npm install --prefer-offline 2>&1 | Out-Null
  npm run build 2>&1 | Out-Null
  $dist = Join-Path $Dir 'dist'
  $dest = Join-Path $out $Subpath
  Copy-Item $dist $dest -Recurse
  Pop-Location
  Write-Host "  Done -> _deploy/$Subpath" -ForegroundColor Green
}

# Main launcher (goes to root)
Write-Host "Building launcher..." -ForegroundColor Cyan
Push-Location $root
npm install --prefer-offline 2>&1 | Out-Null
npm run build 2>&1 | Out-Null
Copy-Item (Join-Path $root 'dist\*') $out -Recurse
Pop-Location
Write-Host "  Done -> _deploy/" -ForegroundColor Green

# PoC builds
Build-PoC (Join-Path $pocs 'HalliMane_POC')            'halliMane'
Build-PoC (Join-Path $pocs 'KalyanKendra_POC')         'kalyanKendra'
Build-PoC (Join-Path $pocs 'Kushals')                  'kushals'
Build-PoC (Join-Path $pocs 'retail-edge-Paragon\dashboard') 'paragon'
Build-PoC (Join-Path $pocs 'reliance-demo')            'reliance'
Build-PoC (Join-Path $pocs 'retail-edge-sultan\dashboard')  'sulthan'
Build-PoC (Join-Path $pocs 'TechnoSport')              'technoSport'
Build-PoC (Join-Path $pocs 'US_Polo_POC')              'usPolo'
Build-PoC (Join-Path $pocs 'V-Bazaar\dashboard')       'vBazaar'

Write-Host ""
Write-Host "All builds complete. Assets assembled in _deploy/" -ForegroundColor Yellow
Write-Host "Next: docker build -t xentrack-dash . && docker-compose up -d" -ForegroundColor Yellow
