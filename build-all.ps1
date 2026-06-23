# build-all.ps1
# Builds all PoC repos and the main launcher, assembles into _deploy/
# Run from the New_POC_Website directory before building the Docker image.

$ErrorActionPreference = 'Continue'
$root  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pocs  = Join-Path $root 'pocs'
$out   = Join-Path $root '_deploy'

# Clean output directory
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

function Invoke-Npm {
  param([string]$Cmd)
  # $Args is a PowerShell automatic variable (array) — never use it as a param name.
  # Run npm without capturing stderr so Vite deprecation warnings don't become errors.
  $null = npm $Cmd.Split(' ')
  if ($LASTEXITCODE -ne 0) { throw "npm $Cmd failed (exit $LASTEXITCODE)" }
}

function Build-PoC {
  param([string]$Dir, [string]$Subpath)
  Write-Host "Building $Subpath ..." -ForegroundColor Cyan
  Push-Location $Dir
  Invoke-Npm -Cmd 'install --prefer-offline'
  Invoke-Npm -Cmd 'run build'
  $dist = Join-Path $Dir 'dist'
  $dest = Join-Path $out $Subpath
  Copy-Item $dist $dest -Recurse
  Pop-Location
  Write-Host "  Done -> _deploy/$Subpath" -ForegroundColor Green
}

# Main launcher (goes to root)
Write-Host "Building launcher..." -ForegroundColor Cyan
Push-Location $root
Invoke-Npm -Cmd 'install --prefer-offline'
Invoke-Npm -Cmd 'run build'
Copy-Item (Join-Path $root 'dist\*') $out -Recurse
Pop-Location
Write-Host "  Done -> _deploy/" -ForegroundColor Green

# PoC builds
Build-PoC (Join-Path $pocs 'halliMane')    'halliMane'
Build-PoC (Join-Path $pocs 'kalyanKendra') 'kalyanKendra'
Build-PoC (Join-Path $pocs 'kushals')      'kushals'
Build-PoC (Join-Path $pocs 'paragon')      'paragon'
Build-PoC (Join-Path $pocs 'reliance')     'reliance'
Build-PoC (Join-Path $pocs 'sulthan')      'sulthan'
Build-PoC (Join-Path $pocs 'technoSport')  'technoSport'
Build-PoC (Join-Path $pocs 'usPolo')       'usPolo'
Build-PoC (Join-Path $pocs 'vBazaar')      'vBazaar'

Write-Host ""
Write-Host "All builds complete. Assets assembled in _deploy/" -ForegroundColor Yellow
Write-Host "Next: docker build -t xentrack-dash . && docker-compose up -d" -ForegroundColor Yellow
