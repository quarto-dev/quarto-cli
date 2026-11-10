#!/usr/bin/env bash
# Summarise the failing CI jobs of a PR (or of one workflow run) without
# loading raw logs: one row per unique failing test, deduplicated across OSes.
#
# Usage: ci-failures.sh <pr-number> [repo]
#        ci-failures.sh --run <run-id> [repo]
#
# Logs are cached per job id under $CI_FAILURES_DIR
# (default: ${TMPDIR:-/tmp}/quarto-ci-failures), so re-runs are cheap.
set -euo pipefail

if [ "${1:-}" = "--run" ]; then
  RUNS="${2:?run id required}"; REPO="${3:-quarto-dev/quarto-cli}"
  echo "Run $RUNS"
else
  PR="${1:?usage: ci-failures.sh <pr-number> | --run <run-id> [repo]}"
  REPO="${2:-quarto-dev/quarto-cli}"
  SHA="$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq .headRefOid)"
  RUNS="$(gh run list --repo "$REPO" --commit "$SHA" --limit 100 \
    --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId')"
  echo "PR #$PR head ${SHA:0:9}: failing runs: $(echo $RUNS)"
  [ -n "$RUNS" ] || { echo "No failing runs."; exit 0; }
fi

D="${CI_FAILURES_DIR:-${TMPDIR:-/tmp}/quarto-ci-failures}"; mkdir -p "$D"
JOBS="$D/jobs-$$.tsv"; : > "$JOBS"
trap 'rm -f "$JOBS"' EXIT

for RUN in $RUNS; do
  gh api "repos/$REPO/actions/runs/$RUN/jobs?per_page=100&filter=latest" --paginate \
    --jq '.jobs[] | select(.conclusion=="failure") | [.id, .name] | @tsv' >> "$JOBS"
done
# Linux jobs first, so excerpts show forward-slash paths.
awk -F'\t' '{print ($2 ~ /ubuntu|linux/ ? 0 : 1) "\t" $0}' "$JOBS" \
  | sort -s -k1,1 | cut -f2- > "$JOBS.sorted" && mv "$JOBS.sorted" "$JOBS"
echo "Failed jobs: $(wc -l < "$JOBS" | tr -d ' ')   Logs: $D"

# gh run view --log silently truncates large logs; the jobs/ID/logs endpoint does not.
while IFS=$'\t' read -r id name; do
  f="$D/$id.log"
  [ -s "$f" ] && continue
  # Publish only a complete download, so a failed fetch is retried next run.
  gh api --allow-escape-sequences "repos/$REPO/actions/jobs/$id/logs" \
    | sed -e 's/\x1b\[[0-9;]*m//g' -e 's/^[0-9T:.-]*Z //' > "$f.part" && mv "$f.part" "$f"
done < "$JOBS"

# Pass 1: one record per (failure, job): kind \t key \t os \t job-id \t excerpt (lines joined by \037)
while IFS=$'\t' read -r id name; do
  os="$(printf '%s' "$name" | sed -nE 's/.*\(([^)]*)\)$/\1/p')"; os="${os:-$name}"
  group="$(printf '%s' "$name" | sed -E 's/ *\([^)]*\)$//')"
  awk -v os="$os" -v id="$id" -v group="$group" '
    function norm(s) { sub(/^\[smoke\] > /, "", s); gsub(/\\/, "/", s); return s }
    function flush(   i, n, out, seen, start) {
      if (title == "") return
      out = verify msg
      if (notfound && nout > 0) {
        # Render failed before verify ran: show the render error from OUTPUT instead.
        out = out "\037render error (OUTPUT tail):"
        n = 0; start = nout
        for (i = nout; i >= 1 && n < 6; i--) if (!(outl[i] in seen)) { seen[outl[i]] = 1; n++; start = i }
        delete seen
        for (i = start; i <= nout; i++) if (!(outl[i] in seen)) { seen[outl[i]] = 1; out = out "\037  " outl[i] }
      }
      print "T\t" norm(title) "\t" os "\t" id "\t" out
      title = ""; verify = ""; msg = ""; nmsg = 0; inmsg = 0; notfound = 0; nout = 0; inout = 0; hdr = 0
    }
    / \.\.\. FAILED \(/ { t = $0; sub(/ \.\.\. FAILED.*/, "", t); print "T\t" norm(t) "\t" os "\t" id "\t"; next }
    /━━━ TEST FAILURE: / { flush(); title = substr($0, index($0, "TEST FAILURE: ") + 14); next }
    title != "" {
      if ($0 ~ /^\[verify\] > /) { verify = substr($0, 1, 200); inmsg = 1; next }
      # The assertion message runs from the first non-blank line after [verify] to the
      # stack trace; noErrors-style messages carry the real diagnostics on later lines.
      if (inmsg) {
        if ($0 ~ /^[ \t]*$/) { if (nmsg) inmsg = 0; next }
        if ($0 ~ /^(AssertionError|NotFound|Error|TypeError|Path): |^[ \t]+at /) { inmsg = 0; next }
        if (nmsg < 6) { msg = msg "\037" substr($0, 1, 240); nmsg++ }
        # Render failed, so no output file: the render error is in OUTPUT.
        if ($0 ~ /NotFound|os error 2|cannot find the file|No output created message|^Path .* doesn.t exist/) notfound = 1
        next
      }
      if ($0 ~ /^OUTPUT:/) { inout = 1; next }
      if ($0 ~ /Stack trace:|throw new AssertionError/) { inout = 0; next }
      if (inout) {
        l = $0; sub(/^[ \t]+/, "", l); sub(/[ \t]+$/, "", l)
        # Skip the echoed "pandoc" options and "metadata" blocks; each ends at a blank line.
        if (l == "pandoc" || l == "metadata") { hdr = 1; next }
        if (l == "") { hdr = 0; next }
        if (!hdr && l !~ /^[0-9]* *\|/ && l != "^") outl[++nout] = substr(l, 1, 240)
      }
    }
    /^##\[error\]/ && !/Process completed with exit code/ {
      print "E\t" substr($0, 10, 300) "\t" os "\t" id "\t" group
    }
    END { flush() }
  ' "$D/$id.log"
done < "$JOBS" > "$D/records-$$.tsv"

# Pass 2: aggregate into one row per test (and per step error), listing the OSes that failed it.
awk -F'\t' -v jobs="$JOBS" -v dir="$D" '
  function addos(list, os) { return index(", " list ", ", ", " os ", ") ? list : (list == "" ? os : list ", " os) }
  BEGIN { while ((getline l < jobs) > 0) { split(l, a, "\t"); jname[a[1]] = a[2]; jorder[++nj] = a[1] } }
  { seenjob[$4] = 1 }
  $1 == "T" {
    testjob[$4] = 1
    if (!($2 in tos)) order[++nt] = $2
    tos[$2] = addos(tos[$2], $3)
    if (ex[$2] == "" && $5 != "") ex[$2] = $5
    if (!($2 in tjob)) tjob[$2] = $4
  }
  $1 == "E" { ejob[++nr] = $4; ekey[nr] = $5 "\t" $2; eosr[nr] = $3 }
  END {
    printf "\n== %d unique failing tests\n", nt
    for (i = 1; i <= nt; i++) {
      t = order[i]; printf "\n[%s] %s\n", tos[t], t
      n = split(ex[t], lines, "\037"); for (j = 1; j <= n; j++) if (lines[j] != "") print "    " lines[j]
      # prereq and teardown-only failures print no TEST FAILURE block.
      if (ex[t] == "") printf "    no TEST FAILURE block (prereq or teardown failure?); grep %s/%s.log\n", dir, tjob[t]
    }
    # A step error in a job that has failing tests only restates those tests.
    for (r = 1; r <= nr; r++) if (!(ejob[r] in testjob)) {
      k = ekey[r]; if (!(k in eos)) eorder[++ne] = k
      eos[k] = addos(eos[k], eosr[r])
    }
    if (ne) printf "\n== %d step errors\n", ne
    for (i = 1; i <= ne; i++) { split(eorder[i], p, "\t"); printf "\n[%s] %s\n    %s\n", eos[eorder[i]], p[1], p[2] }
    m = 0
    for (i = 1; i <= nj; i++) if (!(jorder[i] in seenjob)) {
      if (!m++) print "\n== Failed jobs with no recognised failure (grep their log for the cause)"
      printf "%s\n    %s/%s.log\n", jname[jorder[i]], dir, jorder[i]
    }
  }
' "$D/records-$$.tsv"
rm -f "$D/records-$$.tsv"
