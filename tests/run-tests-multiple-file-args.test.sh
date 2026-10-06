#!/usr/bin/env bash
# Regression test for run-tests.sh collapsing multiple .test.ts file
# arguments into a single glued argv token.
#
# tests/README.md documents passing several .ts files at once, e.g.:
#   ./run-tests.sh smoke/extensions/extension-render-doc.test.ts smoke/smoke-all.test.ts
#
# run-tests.sh built TESTS_TO_RUN by looping `for file in "$*"; do`, which
# joins all positional args into one string before iterating, so the loop
# only ever runs once. That single glued string used to reach deno unquoted,
# where bash's own word-splitting happened to reconstruct separate args -
# but that's incidental, not something quoting the resulting array should be
# allowed to depend on. This test runs the real run-tests.sh with two file
# arguments and confirms each survives as its own deno argv token.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $1"
  exit 1
}

# --- Isolated fake repo skeleton, just enough for run-tests.sh to run ---
mkdir -p "$TMP/tests"
mkdir -p "$TMP/package/scripts/common"
mkdir -p "$TMP/package/dist/bin/tools/stub"
mkdir -p "$TMP/src/resources"

# Strip CR in case this checkout has core.autocrlf=true (Windows dev boxes);
# CI checkouts on Linux/macOS never have CRLF here, this is a local-copy
# normalization only, not part of the fix under test.
tr -d '\r' < "$REPO_ROOT/tests/run-tests.sh" > "$TMP/tests/run-tests.sh"
tr -d '\r' < "$REPO_ROOT/package/scripts/common/utils.sh" > "$TMP/package/scripts/common/utils.sh"
chmod +x "$TMP/tests/run-tests.sh"

RECORD_FILE="$TMP/recorded-argv.txt"
cat > "$TMP/package/dist/bin/tools/stub/deno" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$RECORD_FILE"
exit 0
EOF
chmod +x "$TMP/package/dist/bin/tools/stub/deno"

# --- Invoke the real script with two separate .test.ts file arguments ---
(
  cd "$TMP/tests" || exit 1
  export QUARTO_TESTS_NO_CONFIG=true
  export QUARTO_TESTS_FORCE_NO_VENV=true
  export DENO_DIR=stub
  export RECORD_FILE
  ./run-tests.sh "foo.test.ts" "bar.test.ts"
)

[ -f "$RECORD_FILE" ] || fail "deno stub was never invoked - run-tests.sh did not reach the final deno call"

mapfile -t recorded < "$RECORD_FILE"

found_foo=0
found_bar=0
found_glued=0
for tok in "${recorded[@]}"; do
  [ "$tok" = "foo.test.ts" ] && found_foo=1
  [ "$tok" = "bar.test.ts" ] && found_bar=1
  [ "$tok" = "foo.test.ts bar.test.ts" ] && found_glued=1
done

[ "$found_glued" -eq 0 ] || fail "foo.test.ts and bar.test.ts were glued into a single argv token - multiple file arguments were collapsed"
[ "$found_foo" -eq 1 ] || fail "foo.test.ts missing from deno argv (got: ${recorded[*]})"
[ "$found_bar" -eq 1 ] || fail "bar.test.ts missing from deno argv (got: ${recorded[*]})"

echo "PASS: multiple .test.ts file arguments reached deno as separate argv tokens"
