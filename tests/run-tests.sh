#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Always use the deno bundled with quarto to avoid version mismatches.
# Accepts QUARTO env var or falls back to quarto on PATH.
QUARTO="${QUARTO:-quarto}"

if ! command -v "$QUARTO" &>/dev/null; then
  echo "quarto not found. Either set QUARTO=/path/to/quarto or add it to PATH." >&2
  exit 1
fi

QUARTO_BIN_DIR="$("$QUARTO" --paths | head -1)"

case "$(uname -m)" in
  x86_64)        DENO_ARCH_DIR=x86_64 ;;
  aarch64|arm64) DENO_ARCH_DIR=aarch64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

DENO="$QUARTO_BIN_DIR/tools/$DENO_ARCH_DIR/deno"

if [ ! -x "$DENO" ]; then
  echo "deno not found at $DENO" >&2
  exit 1
fi

cd "$SCRIPT_DIR"

# Run explicit files if given, otherwise discover all .test.ts files
if [ $# -gt 0 ]; then
  "$DENO" test --allow-all --no-check "$@"
else
  "$DENO" test --allow-all --no-check smoke/
fi
