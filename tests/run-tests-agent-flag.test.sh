#!/usr/bin/env bash
# Regression test for the --agent flag on run-tests.sh: verifies the
# --reporter=dot token is inserted exactly once, in the correct position,
# composes with --keep-outputs and smoke-all routing, is stripped before
# the file-type classifier, participates correctly in the (bash-only)
# reporter-collision case with QUARTO_DENO_EXTRA_OPTIONS, and that
# --keep-outputs artifact gating is unaffected by --agent.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# run-tests.sh derives its own architecture directory from $DENO_DIR (see
# "Architecture detection" in run-tests.sh) instead of computing it itself,
# so any REAL (non-stub) invocation below needs DENO_DIR pointed at the arch
# dir name ahead of time, or DENO_ARCH_DIR is empty there and it resolves an
# empty "tools//deno" path. Source the same utils.sh run-tests.sh sources,
# purely to obtain DENO_ARCH_DIR for that - this is not a cache setting,
# don't delete it.
# shellcheck source=/dev/null
source "$REPO_ROOT/package/scripts/common/utils.sh"   # provides DENO_ARCH_DIR

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

RECORD_FILE="$TMP/recorded-argv.txt"
cat > "$TMP/package/dist/bin/tools/stub/deno" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$RECORD_FILE"
exit 0
EOF
chmod +x "$TMP/package/dist/bin/tools/stub/deno"

# docs/smoke-all/ lives INSIDE tests/, not as a sibling - run-tests.sh's
# timing mode does `find docs/smoke-all/` relative to its own cwd (tests/).
: > "$TMP/tests/docs/smoke-all/fixture.qmd"

run_stub() {
  # Runs the fake run-tests.sh with the given test-runner args (NOT
  # including "./run-tests.sh" itself), populates $RECORD_FILE.
  ( cd "$TMP/tests" && \
    QUARTO_TESTS_NO_CONFIG=true \
    QUARTO_TESTS_FORCE_NO_VENV=true \
    DENO_DIR=stub \
    RECORD_FILE="$RECORD_FILE" \
    ./run-tests.sh "$@" )
}

# --- Expectation 4: no flag -> no reporter token at all ---
rm -f "$RECORD_FILE"
run_stub "foo.test.ts" >/dev/null 2>&1
[ -s "$RECORD_FILE" ] || fail "no-flag invocation never reached the stub deno (RECORD_FILE missing or empty)"
mapfile -t recorded < "$RECORD_FILE"
for tok in "${recorded[@]}"; do
  [[ "$tok" == --reporter=* ]] && fail "no-flag run recorded a reporter token: ${recorded[*]}"
done

# --- Expectation 3 + 5: --agent -> exactly one --reporter=dot, no -q, no --quiet, no --agent leak ---
rm -f "$RECORD_FILE"
run_stub "--agent" "foo.test.ts" >/dev/null 2>&1
[ -s "$RECORD_FILE" ] || fail "--agent foo.test.ts invocation never reached the stub deno (RECORD_FILE missing or empty)"
mapfile -t recorded < "$RECORD_FILE"
reporter_count=0
import_map_index=-1
reporter_index=-1
foo_index=-1
for i in "${!recorded[@]}"; do
  tok="${recorded[$i]}"
  [[ "$tok" == --importmap=* ]] && import_map_index=$i
  [[ "$tok" == "--reporter=dot" ]] && { reporter_count=$((reporter_count + 1)); reporter_index=$i; }
  [[ "$tok" == "-q" || "$tok" == "--quiet" ]] && fail "-q/--quiet leaked into argv: ${recorded[*]}"
  [[ "$tok" == "--agent" ]] && fail "--agent itself leaked into deno argv: ${recorded[*]}"
  [[ "$tok" == "foo.test.ts" ]] && foo_index=$i
done
[ "$reporter_count" -eq 1 ] || fail "expected exactly one --reporter=dot token, got $reporter_count (argv: ${recorded[*]})"
[ "$import_map_index" -ge 0 ] || fail "import-map token not found in argv"
[ "$reporter_index" -eq $((import_map_index + 1)) ] || fail "--reporter=dot not immediately after import-map arg (import-map at $import_map_index, reporter at $reporter_index)"
[ "$foo_index" -gt "$reporter_index" ] || fail "target foo.test.ts did not come after --reporter=dot"
echo "PASS: --agent composes to exactly one --reporter=dot, positioned after import-map, before target; no -q/--quiet/--agent leak"

# --agent first, last, middle (two targets), and combined with --keep-outputs
for arg_order in "--agent foo.test.ts" "foo.test.ts --agent" "foo.test.ts --agent bar.test.ts" "--agent --keep-outputs foo.test.ts" "foo.test.ts --keep-outputs --agent"; do
  rm -f "$RECORD_FILE"
  # shellcheck disable=SC2086
  run_stub $arg_order >/dev/null 2>&1
  [ -s "$RECORD_FILE" ] || fail "order '$arg_order' never reached the stub deno (RECORD_FILE missing or empty)"
  mapfile -t recorded < "$RECORD_FILE"
  found_reporter=0
  found_foo=0
  for tok in "${recorded[@]}"; do
    [ "$tok" = "--reporter=dot" ] && found_reporter=1
    [ "$tok" = "--keep-outputs" ] && fail "--keep-outputs reached the deno classifier for order '$arg_order' (argv: ${recorded[*]})"
    [ "$tok" = "--agent" ] && fail "--agent reached the deno classifier for order '$arg_order' (argv: ${recorded[*]})"
    [ "$tok" = "foo.test.ts" ] && found_foo=1
  done
  [ "$found_reporter" -eq 1 ] || fail "--reporter=dot missing for order '$arg_order'"
  [ "$found_foo" -eq 1 ] || fail "foo.test.ts missing for order '$arg_order'"
  if [[ "$arg_order" == *bar.test.ts* ]]; then
    found_bar=0
    for tok in "${recorded[@]}"; do [ "$tok" = "bar.test.ts" ] && found_bar=1; done
    [ "$found_bar" -eq 1 ] || fail "bar.test.ts missing for two-target middle-position order '$arg_order' (argv: ${recorded[*]})"
  fi
done
echo "PASS: --agent works in first/middle/last position, with a second target, and composes with --keep-outputs without either reaching the classifier"

# smoke-all qmd routing with --agent: reporter token must land before the "--"
# separator, and the fixture document itself must land after it
rm -f "$RECORD_FILE"
run_stub "--agent" "docs/smoke-all/fixture.qmd" >/dev/null 2>&1
[ -s "$RECORD_FILE" ] || fail "smoke-all qmd routing invocation never reached the stub deno (RECORD_FILE missing or empty)"
mapfile -t recorded < "$RECORD_FILE"
dashdash_index=-1
reporter_index=-1
smokeall_index=-1
fixture_index=-1
for i in "${!recorded[@]}"; do
  [ "${recorded[$i]}" = "--" ] && dashdash_index=$i
  [ "${recorded[$i]}" = "--reporter=dot" ] && reporter_index=$i
  [[ "${recorded[$i]}" == *smoke-all.test.ts ]] && smokeall_index=$i
  [[ "${recorded[$i]}" == *fixture.qmd ]] && fixture_index=$i
done
[ "$dashdash_index" -ge 0 ] || fail "smoke-all routing: no '--' separator found (argv: ${recorded[*]})"
[ "$smokeall_index" -ge 0 ] || fail "smoke-all routing: smoke-all.test.ts not routed in (argv: ${recorded[*]})"
[ "$reporter_index" -ge 0 ] || fail "smoke-all routing: --reporter=dot missing (argv: ${recorded[*]})"
[ "$fixture_index" -ge 0 ] || fail "smoke-all routing: fixture.qmd missing from argv entirely (argv: ${recorded[*]})"
[ "$reporter_index" -lt "$dashdash_index" ] || fail "smoke-all routing: --reporter=dot landed after '--' separator (argv: ${recorded[*]})"
[ "$fixture_index" -gt "$dashdash_index" ] || fail "smoke-all routing: fixture.qmd did not land after '--' separator (argv: ${recorded[*]})"
echo "PASS: --agent + qmd routes to smoke-all.test.ts with '--' and the fixture document intact after the separator, reporter token before it"

# --- Expectation 7: timing mode carries the reporter in both bash timing
# invocations. /usr/bin/time does not exist in Git Bash on Windows, and
# run-tests.sh's timing branches invoke it directly (not through a
# resolvable PATH lookup we could stub), so bash fails to exec before ever
# reaching the stub deno on that host. Guard on its presence rather than
# weakening the assertions: a declared skip is honest, a vacuous pass from a
# missing record file is not.
if [ -x /usr/bin/time ]; then
  # Timing, per-file. Delete RECORD_FILE first and require it be recreated -
  # reusing a stale file from an earlier step would let this pass even if the
  # timing branch never reached the stub deno at all. Assert token order, not
  # just presence, matching the rigor of the generic-path check above.
  rm -f "$RECORD_FILE"
  ( cd "$TMP/tests" && QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true DENO_DIR=stub QUARTO_TEST_TIMING=true RECORD_FILE="$RECORD_FILE" ./run-tests.sh "--agent" "foo.test.ts" >/dev/null 2>&1 )
  [ -s "$RECORD_FILE" ] || fail "timing per-file invocation never reached the stub deno (RECORD_FILE missing or empty)"
  mapfile -t recorded < "$RECORD_FILE"
  import_map_index=-1
  reporter_index=-1
  foo_index=-1
  for i in "${!recorded[@]}"; do
    tok="${recorded[$i]}"
    [[ "$tok" == --importmap=* ]] && import_map_index=$i
    [ "$tok" = "--reporter=dot" ] && reporter_index=$i
    [ "$tok" = "foo.test.ts" ] && foo_index=$i
  done
  [ "$import_map_index" -ge 0 ] || fail "timing per-file: import-map token not found (argv: ${recorded[*]})"
  [ "$reporter_index" -eq $((import_map_index + 1)) ] || fail "timing per-file: --reporter=dot not immediately after import-map arg (argv: ${recorded[*]})"
  [ "$foo_index" -gt "$reporter_index" ] || fail "timing per-file: target did not come after --reporter=dot (argv: ${recorded[*]})"

  # Timing, smoke-all per-document. Same freshness + position rigor, and check
  # the fixture document lands after the "--" separator, not just that a
  # reporter token exists somewhere in the recorded argv.
  rm -f "$RECORD_FILE"
  ( cd "$TMP/tests" && QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true DENO_DIR=stub QUARTO_TEST_TIMING=true RECORD_FILE="$RECORD_FILE" ./run-tests.sh "--agent" "./smoke/smoke-all.test.ts" >/dev/null 2>&1 )
  [ -s "$RECORD_FILE" ] || fail "timing smoke-all invocation never reached the stub deno (RECORD_FILE missing or empty)"
  mapfile -t recorded < "$RECORD_FILE"
  import_map_index=-1
  reporter_index=-1
  dashdash_index=-1
  fixture_index=-1
  for i in "${!recorded[@]}"; do
    tok="${recorded[$i]}"
    [[ "$tok" == --importmap=* ]] && import_map_index=$i
    [ "$tok" = "--reporter=dot" ] && reporter_index=$i
    [ "$tok" = "--" ] && dashdash_index=$i
    [[ "$tok" == *fixture.qmd ]] && fixture_index=$i
  done
  [ "$import_map_index" -ge 0 ] || fail "timing smoke-all: import-map token not found (argv: ${recorded[*]})"
  [ "$reporter_index" -eq $((import_map_index + 1)) ] || fail "timing smoke-all: --reporter=dot not immediately after import-map arg (argv: ${recorded[*]})"
  [ "$dashdash_index" -gt "$reporter_index" ] || fail "timing smoke-all: '--' separator missing or not after --reporter=dot (argv: ${recorded[*]})"
  [ "$fixture_index" -gt "$dashdash_index" ] || fail "timing smoke-all: fixture.qmd did not land after '--' separator (argv: ${recorded[*]})"
  echo "PASS: both bash timing invocations freshly reached the stub deno with --reporter=dot in the correct position"
else
  echo "SKIP: timing-mode expectations - /usr/bin/time not available on this host (run-tests.sh timing branches invoke it directly)"
fi

# --- Expectation 8 (argv half): collision records both reporter tokens ---
rm -f "$RECORD_FILE"
( cd "$TMP/tests" && QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true DENO_DIR=stub QUARTO_DENO_EXTRA_OPTIONS="--reporter=tap" RECORD_FILE="$RECORD_FILE" ./run-tests.sh "--agent" "foo.test.ts" >/dev/null 2>&1 )
[ -s "$RECORD_FILE" ] || fail "collision (stub) invocation never reached the stub deno (RECORD_FILE missing or empty)"
mapfile -t recorded < "$RECORD_FILE"
found_dot=0
found_tap=0
for tok in "${recorded[@]}"; do
  [ "$tok" = "--reporter=dot" ] && found_dot=1
  [ "$tok" = "--reporter=tap" ] && found_tap=1
done
[ "$found_dot" -eq 1 ] && [ "$found_tap" -eq 1 ] || fail "collision case did not record both reporter tokens (argv: ${recorded[*]})"
echo "PASS: --agent + QUARTO_DENO_EXTRA_OPTIONS reporter records both tokens in argv (stub, construction proof)"

# --- Expectation 8 (behavioral half): real deno rejects the duplicate
# reporter. Bypasses the wrapper entirely, per the design's split (a stub
# can prove construction but not deno's own exit code/diagnostic).
DENO_BIN=""
for candidate in "$REPO_ROOT"/package/dist/bin/tools/*/deno "$REPO_ROOT"/package/dist/bin/tools/*/deno.exe; do
  [ -f "$candidate" ] && { DENO_BIN="$candidate"; break; }
done
[ -n "$DENO_BIN" ] || fail "could not find a built deno binary under package/dist/bin/tools/*/deno[.exe] - run quarto-bld configure first"

cat > "$TMP/throwaway-collision.test.ts" <<'EOF'
Deno.test("throwaway", () => {});
EOF

collision_output="$("$DENO_BIN" test --reporter=dot --reporter=tap "$TMP/throwaway-collision.test.ts" 2>&1)"
collision_exit=$?
[ "$collision_exit" -ne 0 ] || fail "expected non-zero exit from duplicate --reporter, got 0"
# Two substrings rather than the full sentence: tolerant of minor wording
# drift across deno versions, but specific enough that an unrelated stderr
# message merely mentioning "reporter" (e.g. a deprecation notice) can't
# satisfy it.
echo "$collision_output" | grep -qi "reporter" || fail "expected a reporter-related diagnostic, got: $collision_output"
echo "$collision_output" | grep -qi "multiple times" || fail "expected the duplicate-reporter diagnostic to mention 'multiple times', got: $collision_output"
echo "PASS: real deno 2.7.14 exits non-zero with the duplicate-reporter diagnostic on duplicate --reporter tokens"

# The two checks above prove deno's own parser rejects a duplicate --reporter,
# and (the argv half above) prove the wrapper constructs both tokens into
# argv - but neither proves the WRAPPER itself surfaces the diagnostic and
# propagates deno's non-zero exit end-to-end. Confirm that directly, through
# the real (non-stub) wrapper, since exit-code passthrough on a
# CLI-usage-error path is a different code path than the "test assertion
# failed" case already checked elsewhere. DENO_DIR must be set to the real
# arch dir here (see the top-of-script comment) or the wrapper resolves an
# empty tools//deno path.
collision_wrapper_output="$( cd "$REPO_ROOT/tests" && QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true DENO_DIR="$DENO_ARCH_DIR" QUARTO_DENO_EXTRA_OPTIONS="--reporter=tap" ./run-tests.sh --agent unit/filter-paths.test.ts 2>&1 )"
collision_wrapper_exit=$?
[ "$collision_wrapper_exit" -ne 0 ] || fail "expected run-tests.sh to exit non-zero when --agent collides with QUARTO_DENO_EXTRA_OPTIONS, got 0"
echo "$collision_wrapper_output" | grep -qi "multiple times" || fail "expected the wrapper's own output to surface deno's duplicate-reporter diagnostic, got: $collision_wrapper_output"
echo "PASS: the real (non-stub) wrapper surfaces the duplicate-reporter diagnostic and propagates deno's non-zero exit"

# --- Expectation 9: keep-outputs paired runs, real render, identical with
# and without --agent. Runs against the real repo's tests/run-tests.sh (not
# the fake skeleton) and the tests/smoke/render/render-minimal.test.ts
# fixture, whose artifact is tests/docs/minimal.html (single file, no
# support dir - render-minimal.test.ts asserts noSupporting: true).
# Requires a built distribution.
ARTIFACT="$REPO_ROOT/tests/docs/minimal.html"
trap 'rm -f "$ARTIFACT"; rm -rf "$TMP"' EXIT   # replaces the earlier bare TMP-only trap - also covers Ctrl-C mid-render

run_and_check() {
  local expect_exists="$1"; shift
  rm -f "$ARTIFACT"
  local status
  ( cd "$REPO_ROOT/tests" && QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_FORCE_NO_VENV=true DENO_DIR="$DENO_ARCH_DIR" ./run-tests.sh "$@" smoke/render/render-minimal.test.ts >/dev/null 2>&1 )
  status=$?
  [ "$status" -eq 0 ] || fail "run-tests.sh exited $status for args: $* (a render failure would make either outcome meaningless)"
  if [ "$expect_exists" = "yes" ]; then
    [ -f "$ARTIFACT" ] || fail "expected $ARTIFACT to survive (args: $*)"
  else
    [ ! -f "$ARTIFACT" ] || fail "expected $ARTIFACT to be removed (args: $*)"
  fi
  rm -f "$ARTIFACT"
}

run_and_check no                            # no flags: removed
run_and_check yes --keep-outputs            # keep-outputs alone: survives
run_and_check no --agent                    # agent alone: removed (same as no flags)
run_and_check yes --agent --keep-outputs    # both: survives, identically to keep-outputs alone
echo "PASS: keep-outputs artifact gating is removed/retained identically with and without --agent"
