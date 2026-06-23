#!/usr/bin/env bash
# build-all.sh
# Builds all PoC repos and the main launcher, assembles into _deploy/
# Run from the New_POC_Website directory before building the Docker image.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
POCS="$ROOT/pocs"
OUT="$ROOT/_deploy"

build_poc() {
  local dir="$1"
  local subpath="$2"
  echo "Building $subpath ..."
  pushd "$dir" > /dev/null
  npm install --prefer-offline
  npm run build
  cp -r "$dir/dist" "$OUT/$subpath"
  popd > /dev/null
  echo "  Done -> _deploy/$subpath"
}

# Clean output directory
rm -rf "$OUT"
mkdir -p "$OUT"

# Main launcher (goes to root)
echo "Building launcher..."
pushd "$ROOT" > /dev/null
npm install --prefer-offline
npm run build
cp -r "$ROOT/dist/." "$OUT/"
popd > /dev/null
echo "  Done -> _deploy/"

# PoC builds
build_poc "$POCS/halliMane"    halliMane
build_poc "$POCS/kalyanKendra" kalyanKendra
build_poc "$POCS/kushals"      kushals
build_poc "$POCS/paragon"      paragon
build_poc "$POCS/reliance"     reliance
build_poc "$POCS/sulthan"      sulthan
build_poc "$POCS/technoSport"  technoSport
build_poc "$POCS/usPolo"       usPolo
build_poc "$POCS/vBazaar"      vBazaar

echo ""
echo "All builds complete. Assets assembled in _deploy/"
echo "Next: docker-compose up -d --build"
