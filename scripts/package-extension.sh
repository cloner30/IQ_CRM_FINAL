#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT/chrome-extension"
OUT="$ROOT/chrome-extension.zip"
cd "$EXT_DIR"
rm -f "$OUT"
zip -r "$OUT" . -x "*.DS_Store"
echo "Packaged extension: $OUT"
