#!/usr/bin/env bash
# Regression test for GitHub Actions log grouping in run-tests.sh timing mode.
# A passing invocation must be replayed inside one group named after its
# target (the harness's own group markers dropped); a failing one must be
# replayed verbatim; orchestrated and off-CI runs must be left untouched.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

if [ ! -x /usr/bin/time ]; then
  echo "SKIP: timing-mode grouping expectations - /usr/bin/time not available on this host (run-tests.sh timing branches invoke it directly)"
  exit 0
fi

unset GITHUB_ACTIONS QUARTO_TESTS_GHA_ORCHESTRATED

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $1"
  exit 1
}

# --- Isolated fake repo skeleton, just enough for run-tests.sh to run ---
mkdir -p "$TMP/tests/docs/smoke-all"
mkdir -p "$TMP/package/scripts/common"
mkdir -p "$TMP/package/dist/bin/tools/stub"
mkdir -p "$TMP/src/resources"

tr -d '\r' < "$REPO_ROOT/tests/run-tests.sh" > "$TMP/tests/run-tests.sh"
tr -d '\r' < "$REPO_ROOT/package/scripts/common/utils.sh" > "$TMP/package/scripts/common/utils.sh"
chmod +x "$TMP/tests/run-tests.sh"

# Stub deno imitating a harness-owned Deno run: banners around module-level
# output, the harness's own group markers, and Deno's end-of-run summary.
cat > "$TMP/package/dist/bin/tools/stub/deno" <<'EOF'
#!/usr/bin/env bash
echo "------- pre-test output -------"
echo "::group::smoke/smoke-all.test.ts"
echo "----- pre-test output end -----"
echo "running 1 test from ./smoke/smoke-all.test.ts"
echo "STUB-BODY"
echo "------- post-test output -------"
echo "::endgroup::"
echo "----- post-test output end -----"
echo
if [ "${STUB_EXIT:-0}" -eq 0 ]; then echo "ok | 1 passed | 0 failed (1s)"; else echo "FAILED | 0 passed | 1 failed (1s)"; fi
[ -n "${STUB_NO_TRAILING_NL:-}" ] && printf 'TAIL-NO-NL'
exit "${STUB_EXIT:-0}"
EOF
chmod +x "$TMP/package/dist/bin/tools/stub/deno"

: > "$TMP/tests/docs/smoke-all/fixture.qmd"

OUT="$TMP/out.txt"
TIMING="$TMP/tests/timing-test.txt"
RC=0

# run_timing <target> [VAR=value ...]: runs the fake run-tests.sh in timing
# mode, output to $OUT, exit code to $RC, timing file in $TIMING.
run_timing() {
  local target="$1"; shift
  rm -f "$TIMING"
  ( cd "$TMP/tests" && env QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true \
      DENO_DIR=stub QUARTO_TEST_TIMING=timing-test.txt "$@" ./run-tests.sh "$target" ) > "$OUT" 2>&1
  RC=$?
}

# line_of <exact line> [after-line]: first line number equal to the text after
# the given line number (0 if absent).
line_of() {
  local text="$1" after="${2:-0}"
  grep -nxF -- "$text" "$OUT" | cut -d: -f1 | awk -v a="$after" '$1 > a { print; exit }'
}
count_of() { grep -cxF -- "$1" "$OUT"; }
count_prefix() { grep -c -- "^$1" "$OUT"; }

SMOKE="./smoke/smoke-all.test.ts"
LABEL="smoke-all -- docs/smoke-all/fixture.qmd"

# --- A. GHA pass, smoke-all ---
run_timing "$SMOKE" GITHUB_ACTIONS=true
[ "$(count_of "::group::$LABEL")" -eq 1 ] || fail "A: expected exactly one '::group::$LABEL' line (output: $OUT)"
[ "$(count_of "::group::smoke/smoke-all.test.ts")" -eq 0 ] || fail "A: harness group line leaked into the replay (output: $OUT)"
[ "$(count_of "::endgroup::")" -eq 1 ] || fail "A: expected exactly one ::endgroup:: line (output: $OUT)"
g=$(line_of "::group::$LABEL"); e=$(line_of "::endgroup::")
[ -n "$g" ] && [ -n "$e" ] || fail "A: group or endgroup line missing (output: $OUT)"
p=$(line_of "------- pre-test output -------" "$g"); k=$(line_of "ok | 1 passed | 0 failed (1s)" "$g")
{ [ -n "$p" ] && [ "$p" -lt "$e" ]; } || fail "A: pre-test banner not inside the group (output: $OUT)"
{ [ -n "$k" ] && [ "$k" -lt "$e" ]; } || fail "A: 'ok |' summary not inside the group (output: $OUT)"
t=$(line_of "> timing $LABEL")
{ [ -n "$t" ] && [ "$t" -lt "$g" ]; } || fail "A: '> timing $LABEL' line missing or not before the group (output: $OUT)"
[ "$RC" -eq 0 ] || fail "A: expected exit code 0, got $RC (output: $OUT)"
grep -qxF "$SMOKE -- docs/smoke-all/fixture.qmd" "$TIMING" || fail "A: timing file lacks the smoke-all entry"
grep -qE ' real .* user .* sys' "$TIMING" || fail "A: timing file lacks the real/user/sys line"
echo "PASS: A: GHA passing smoke-all document is grouped, timing file intact"

# --- B. GHA fail, smoke-all ---
run_timing "$SMOKE" GITHUB_ACTIONS=true STUB_EXIT=1
[ "$(count_prefix "::group::smoke-all -- ")" -eq 0 ] || fail "B: failing run must not get a wrapper group (output: $OUT)"
g=$(line_of "::group::smoke/smoke-all.test.ts"); e=$(line_of "::endgroup::")
{ [ -n "$g" ] && [ -n "$e" ]; } || fail "B: the stub's own group markers must be replayed verbatim (output: $OUT)"
f=$(line_of "FAILED | 0 passed | 1 failed (1s)" "$e")
[ -n "$f" ] || fail "B: FAILED summary missing after the stub's ::endgroup:: (output: $OUT)"
[ "$RC" -ne 0 ] || fail "B: expected non-zero exit code (output: $OUT)"
grep -q 'Command exited with non-zero status 1' "$TIMING" || fail "B: timing file lacks the non-zero status record"
echo "PASS: B: GHA failing smoke-all document is replayed unchanged"

# --- C. Orchestrated ---
run_timing "$SMOKE" GITHUB_ACTIONS=true QUARTO_TESTS_GHA_ORCHESTRATED=1
[ "$(count_prefix "::group::smoke-all -- ")" -eq 0 ] || fail "C: orchestrated run got a wrapper group (output: $OUT)"
[ "$(count_prefix "> timing ")" -eq 0 ] || fail "C: orchestrated run printed a '> timing' line (output: $OUT)"
[ -n "$(line_of "::group::smoke/smoke-all.test.ts")" ] || fail "C: stub's own group line missing (output: $OUT)"
echo "PASS: C: orchestrated run is not wrapped"

# --- C2. Off CI ---
run_timing "$SMOKE"
[ "$(count_prefix "::group::smoke-all -- ")" -eq 0 ] || fail "C2: off-CI run got a wrapper group (output: $OUT)"
[ "$(count_prefix "> timing ")" -eq 0 ] || fail "C2: off-CI run printed a '> timing' line (output: $OUT)"
[ -n "$(line_of "::group::smoke/smoke-all.test.ts")" ] || fail "C2: stub's own group line missing (output: $OUT)"
echo "PASS: C2: off-CI run is not wrapped"

# --- D. GHA pass, test file ---
run_timing "foo.test.ts" GITHUB_ACTIONS=true
[ "$(count_of "::group::foo.test.ts")" -eq 1 ] || fail "D: expected exactly one '::group::foo.test.ts' line (output: $OUT)"
[ "$(count_of "::endgroup::")" -eq 1 ] || fail "D: expected exactly one ::endgroup:: line (output: $OUT)"
g=$(line_of "::group::foo.test.ts"); e=$(line_of "::endgroup::"); k=$(line_of "ok | 1 passed | 0 failed (1s)")
{ [ -n "$g" ] && [ -n "$e" ] && [ -n "$k" ] && [ "$g" -lt "$k" ] && [ "$k" -lt "$e" ]; } || fail "D: 'ok |' line not between group and endgroup (output: $OUT)"
echo "PASS: D: GHA passing test file is grouped under its path"

# --- E. GHA pass, no trailing newline ---
run_timing "$SMOKE" GITHUB_ACTIONS=true STUB_NO_TRAILING_NL=1
[ "$(tail -n 1 "$OUT")" = "::endgroup::" ] || fail "E: last line is not exactly ::endgroup:: (output: $OUT)"
[ -n "$(line_of "TAIL-NO-NL")" ] || fail "E: 'TAIL-NO-NL' must sit on its own line (output: $OUT)"
echo "PASS: E: ::endgroup:: starts at column 0 after output without trailing newline"

# --- F. GHA fail, capture setup fails ---
run_timing "$SMOKE" GITHUB_ACTIONS=true STUB_EXIT=1 TMPDIR="$TMP/does-not-exist"
[ -n "$(line_of "STUB-BODY")" ] || fail "F: stub did not run when mktemp failed (output: $OUT)"
grep -q 'Command exited with non-zero status 1' "$TIMING" || fail "F: timing file lacks the non-zero status record"
[ "$RC" -ne 0 ] || fail "F: expected non-zero exit code (output: $OUT)"
echo "PASS: F: command still runs and failure is recorded when capture setup fails"
