#!/usr/bin/env sh
set -e
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if command -v node >/dev/null 2>&1 && [ -f "$ROOT_DIR/scripts/serve-vidaa.mjs" ]; then
  cd "$ROOT_DIR"
  exec node scripts/serve-vidaa.mjs
else
  exec python3 "$SCRIPT_DIR/server.py"
fi
