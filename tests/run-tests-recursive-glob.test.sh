#!/usr/bin/env bash
# Regression test for run-tests.sh silently truncating recursive ** glob
# buckets on Linux/macOS (quarto-cli-jho3).
#
# Runs the real run-tests.sh against a nested qmd fixture, with the deno
# binary swapped for a recorder stub (via the DENO_DIR override run-tests.sh
# already supports), and checks that a file nested two directories deep
# under a `**` bucket still reaches the resolved test-file set. The
# assertion re-expands any still-glob-shaped token itself (mirroring what
# smoke-all.test.ts's expandGlobSync does), so it passes regardless of
# whether the fix quotes the pattern through to deno or expands it in bash.
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

# --- Nested fixture: one .qmd at depth 1, one at depth 2 under qmd-files/ ---
mkdir -p "$TMP/qmd-files/a/b"
: > "$TMP/qmd-files/a/one.qmd"
: > "$TMP/qmd-files/a/b/two.qmd"

# --- Invoke the real script exactly as test-smokes.yml's bucket runner does ---
(
  cd "$TMP/tests" || exit 1
  export QUARTO_TESTS_NO_CONFIG=true
  export QUARTO_TESTS_FORCE_NO_VENV=true
  export DENO_DIR=stub
  export RECORD_FILE
  ./run-tests.sh "../qmd-files/**/*.qmd"
)

[ -f "$RECORD_FILE" ] || fail "deno stub was never invoked - run-tests.sh did not reach the final deno call"

mapfile -t recorded < "$RECORD_FILE"

dashdash_index=-1
for i in "${!recorded[@]}"; do
  if [ "${recorded[$i]}" = "--" ]; then
    dashdash_index=$i
    break
  fi
done
[ "$dashdash_index" -ge 0 ] || fail "no isolated '--' token in deno argv (got: ${recorded[*]})"

# Resolve the file tokens after '--' into an actual file set, expanding any
# token that still looks like a glob pattern (mirrors expandGlobSync).
resolved=()
(
  cd "$TMP/tests" || exit 1
  shopt -s globstar nullglob
  for ((i = dashdash_index + 1; i < ${#recorded[@]}; i++)); do
    tok="${recorded[$i]}"
    if [[ "$tok" == *"*"* ]]; then
      for f in $tok; do
        echo "$f"
      done
    else
      echo "$tok"
    fi
  done
) > "$TMP/resolved-files.txt"

grep -q 'a/one\.qmd$' "$TMP/resolved-files.txt" || fail "depth-1 fixture file (qmd-files/a/one.qmd) missing from resolved test set"
grep -q 'a/b/two\.qmd$' "$TMP/resolved-files.txt" || fail "depth-2 fixture file (qmd-files/a/b/two.qmd) missing from resolved test set - recursive ** bucket was silently truncated"

echo "PASS: recursive ** bucket resolved both depth-1 and depth-2 fixture files"
