#!/bin/bash
# Validate Lua type stubs for internal consistency using LuaLS --check.
#
# Checks that:
# - All referenced types exist (pandoc.Blocks, pandoc.Div, etc.)
# - Annotation syntax is valid
# - No internal contradictions between stubs
#
# Does NOT check that stubs match runtime — use /audit-lua-types skill for that.
#
# Requirements: lua-language-server on PATH
# Usage: bash tools/check-lua-types.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUB_DIR="$REPO_ROOT/src/resources/lua-types"
LUARC_TEMP=$(mktemp)

if ! command -v lua-language-server &>/dev/null; then
  echo "ERROR: lua-language-server not found on PATH"
  echo "Install: scoop install lua-language-server (Windows)"
  echo "         brew install lua-language-server (macOS)"
  exit 1
fi

# .luarc.json with full library so pandoc types resolve
cat > "$LUARC_TEMP" <<EOF
{
  "Lua.runtime.version": "Lua 5.3",
  "Lua.workspace.library": ["$REPO_ROOT/src/resources/lua-types"],
  "Lua.workspace.checkThirdParty": false
}
EOF

trap 'rm -f "$LUARC_TEMP"' EXIT

echo "Checking Lua type stubs: $STUB_DIR"

OUTPUT=$(lua-language-server \
  --check="$STUB_DIR" \
  --configpath="$LUARC_TEMP" \
  --checklevel=Warning \
  --check_format=pretty 2>&1) || true

# Strip ANSI color codes
CLEAN=$(echo "$OUTPUT" | sed 's/\x1b\[[0-9;]*m//g')

if echo "$CLEAN" | grep -q "no problems found"; then
  echo "OK: All Lua type stubs are internally consistent"
  exit 0
else
  echo "FAIL: Problems found in Lua type stubs"
  echo ""
  echo "$CLEAN" | grep -E "\.lua:" || true
  echo ""
  echo "$CLEAN" | grep "problems found" || true
  exit 1
fi
