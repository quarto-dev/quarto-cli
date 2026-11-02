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

# Stub deno. STUB_MODE selects what it prints:
#   harness (default) - harness-owned run: banners, the harness's own group
#                       markers, Deno's end-of-run summary
#   plain             - plain Deno.test file: no banners, no markers
#   markers_only      - nothing but harness group markers
#   empty             - no output at all
# STUB_EXIT sets the exit code; STUB_NO_TRAILING_NL appends an unterminated line.
cat > "$TMP/package/dist/bin/tools/stub/deno" <<'EOF'
#!/usr/bin/env bash
summary() {
  if [ "${STUB_EXIT:-0}" -eq 0 ]; then echo "ok | 1 passed | 0 failed (1s)"; else echo "FAILED | 0 passed | 1 failed (1s)"; fi
}
case "${STUB_MODE:-harness}" in
  harness)
    echo "------- pre-test output -------"
    echo "::group::smoke/smoke-all.test.ts"
    echo "----- pre-test output end -----"
    echo "running 1 test from ./smoke/smoke-all.test.ts"
    echo "STUB-BODY"
    echo "------- post-test output -------"
    echo "::endgroup::"
    echo "----- post-test output end -----"
    echo
    summary
    ;;
  plain)
    echo "running 1 test from ./foo.test.ts"
    echo "PLAIN-BODY"
    echo
    summary
    ;;
  markers_only)
    echo "::group::smoke/smoke-all.test.ts"
    echo "::endgroup::"
    ;;
  empty)
    ;;
  *)
    echo "stub deno: unknown STUB_MODE=$STUB_MODE" >&2
    exit 99
    ;;
esac
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
e=$(line_of "::endgroup::")
[ "$(sed -n "$((e - 1))p" "$OUT")" = "TAIL-NO-NL" ] || fail "E: blank or extra line between 'TAIL-NO-NL' and ::endgroup:: (output: $OUT)"
echo "PASS: E: ::endgroup:: starts at column 0 after output without trailing newline"

# --- F. GHA fail, capture setup fails ---
run_timing "$SMOKE" GITHUB_ACTIONS=true STUB_EXIT=1 TMPDIR="$TMP/does-not-exist"
[ -n "$(line_of "STUB-BODY")" ] || fail "F: stub did not run when mktemp failed (output: $OUT)"
grep -q 'Command exited with non-zero status 1' "$TIMING" || fail "F: timing file lacks the non-zero status record"
[ "$RC" -ne 0 ] || fail "F: expected non-zero exit code (output: $OUT)"
echo "PASS: F: command still runs and failure is recorded when capture setup fails"

# --- G1. GHA pass, marker-free test file ---
run_timing "foo.test.ts" GITHUB_ACTIONS=true STUB_MODE=plain
[ "$(count_of "::group::foo.test.ts")" -eq 1 ] || fail "G1: expected exactly one '::group::foo.test.ts' line (output: $OUT)"
[ "$(count_prefix "::group::")" -eq 1 ] || fail "G1: expected the wrapper to be the only group (output: $OUT)"
[ "$(count_of "::endgroup::")" -eq 1 ] || fail "G1: expected exactly one ::endgroup:: line (output: $OUT)"
g=$(line_of "::group::foo.test.ts"); e=$(line_of "::endgroup::")
b=$(line_of "PLAIN-BODY" "$g"); k=$(line_of "ok | 1 passed | 0 failed (1s)" "$g")
{ [ -n "$g" ] && [ -n "$e" ] && [ -n "$b" ] && [ -n "$k" ] && [ "$b" -lt "$e" ] && [ "$k" -lt "$e" ]; } || fail "G1: body and 'ok |' line not inside the group (output: $OUT)"
[ "$(tail -n 1 "$OUT")" = "::endgroup::" ] || fail "G1: last line is not exactly ::endgroup:: (output: $OUT)"
[ "$RC" -eq 0 ] || fail "G1: expected exit code 0, got $RC (output: $OUT)"
grep -qxF "foo.test.ts" "$TIMING" || fail "G1: timing file lacks the foo.test.ts entry"
! grep -q 'Command exited with non-zero status' "$TIMING" || fail "G1: timing file records a non-zero status"
echo "PASS: G1: GHA passing marker-free test file is grouped under its path"

# --- G2. GHA fail, marker-free test file ---
run_timing "foo.test.ts" GITHUB_ACTIONS=true STUB_MODE=plain STUB_EXIT=1
[ "$(count_prefix "::group::")" -eq 0 ] || fail "G2: failing run must not get a wrapper group (output: $OUT)"
[ "$(count_of "::endgroup::")" -eq 0 ] || fail "G2: failing marker-free run printed an ::endgroup:: (output: $OUT)"
t=$(line_of "> timing foo.test.ts"); b=$(line_of "PLAIN-BODY" "$t"); f=$(line_of "FAILED | 0 passed | 1 failed (1s)" "$b")
{ [ -n "$t" ] && [ -n "$b" ] && [ -n "$f" ]; } || fail "G2: output not replayed verbatim after '> timing' (output: $OUT)"
[ "$RC" -ne 0 ] || fail "G2: expected non-zero exit code (output: $OUT)"
grep -q 'Command exited with non-zero status 1' "$TIMING" || fail "G2: timing file lacks the non-zero status record"
echo "PASS: G2: GHA failing marker-free test file is replayed unchanged"

# --- G3/G4. GHA pass, marker-only and empty output, two targets ---
# grep -Ev filters out every line (exit status 1); the run must still produce
# an empty group per target and go on to the next target.
for mode in markers_only empty; do
  c="G3"; [ "$mode" = empty ] && c="G4"
  run_timing "foo.test.ts bar.test.ts" GITHUB_ACTIONS=true STUB_MODE="$mode"
  [ "$(count_of "::group::smoke/smoke-all.test.ts")" -eq 0 ] || fail "$c: harness group line leaked into the replay (output: $OUT)"
  [ "$(count_prefix "::group::")" -eq 2 ] || fail "$c: expected exactly two group lines (output: $OUT)"
  [ "$(count_of "::endgroup::")" -eq 2 ] || fail "$c: expected exactly two ::endgroup:: lines (output: $OUT)"
  g1=$(line_of "::group::foo.test.ts"); e1=$(line_of "::endgroup::" "$g1")
  g2=$(line_of "::group::bar.test.ts" "$e1"); e2=$(line_of "::endgroup::" "$g2")
  { [ -n "$g1" ] && [ -n "$e1" ] && [ -n "$g2" ] && [ -n "$e2" ]; } || fail "$c: groups missing or out of order, second target may not have run (output: $OUT)"
  { [ "$e1" -eq $((g1 + 1)) ] && [ "$e2" -eq $((g2 + 1)) ]; } || fail "$c: expected empty groups, ::endgroup:: right after ::group:: (output: $OUT)"
  [ "$(tail -n 1 "$OUT")" = "::endgroup::" ] || fail "$c: last line is not exactly ::endgroup:: (output: $OUT)"
  [ "$RC" -eq 0 ] || fail "$c: expected exit code 0, got $RC (output: $OUT)"
  { grep -qxF "foo.test.ts" "$TIMING" && grep -qxF "bar.test.ts" "$TIMING"; } || fail "$c: timing file lacks an entry"
  ! grep -q 'Command exited with non-zero status' "$TIMING" || fail "$c: timing file records a non-zero status"
  echo "PASS: $c: GHA passing $mode run gives an empty group and does not stop the loop"
done

# --- G5. run_timed's own return value ---
# The script's exit code comes from the timing file, so it cannot reveal a
# filter status leaking out of run_timed; call the function directly.
awk '/^run_timed\(\) \{/,/^\}/' "$TMP/tests/run-tests.sh" > "$TMP/run_timed.sh"
grep -q '^run_timed() {' "$TMP/run_timed.sh" || fail "G5: could not extract run_timed from run-tests.sh"
call_run_timed() {  # call_run_timed <STUB_MODE> <STUB_EXIT>; status in RC
  ( set +u
    export GITHUB_ACTIONS=true STUB_MODE="$1" STUB_EXIT="$2" QUARTO_TEST_TIMING="$TMP/g5-timing.txt"
    unset QUARTO_TESTS_GHA_ORCHESTRATED STUB_NO_TRAILING_NL
    source "$TMP/run_timed.sh"
    run_timed g5 "$TMP/package/dist/bin/tools/stub/deno" ) > "$OUT" 2>&1
  RC=$?
}
for mode in markers_only empty; do
  call_run_timed "$mode" 0
  [ "$RC" -eq 0 ] || fail "G5: run_timed returned $RC for a passing $mode run, filter status leaked (output: $OUT)"
done
call_run_timed plain 3
[ "$RC" -eq 3 ] || fail "G5: run_timed returned $RC, expected the command's status 3 (output: $OUT)"
echo "PASS: G5: run_timed returns the command's status, never the filter's"
