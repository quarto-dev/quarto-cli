#!/usr/bin/env bash
# Contract tests for select-candidates.sh. Run: bash test-select-candidates.sh
set -u

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
script="$here/select-candidates.sh"
fixture="$here/fixtures/search.json"
now="2026-11-27T12:00:00Z"
fails=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

check() {
  if [ "$2" = "$3" ]; then
    echo "PASS $1"
  else
    echo "FAIL $1: expected [$3] got [$2]"
    fails=$((fails + 1))
  fi
}

header() { printf '%s\n' "$1" | jq -c 'select(.type=="header")'; }
numbers() { printf '%s\n' "$1" | jq -c -s '[.[] | select(.type=="candidate") | .number]'; }
fresh_dir() { mktemp -d "$tmp/state.XXXXXX"; }

# ordinary_window
d=$(fresh_dir)
printf '2026-11-20T00:00:00Z\n' > "$d/last-run"
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d")
check ordinary_window "$(header "$out" | jq -c '[.mode, .cutoff]')" '["ordinary","2026-11-20T00:00:00Z"]'
check ordinary_window_numbers "$(numbers "$out")" '[1001,1007,1008,1009]'
check header_is_first_line "$(printf '%s\n' "$out" | head -n 1 | jq -r .type)" header

# exclusion_counts (CRLF skip file)
printf '1007\r\n\n# note\n' > "$tmp/skip.txt"
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d" --skip-file "$tmp/skip.txt")
check exclusion_counts "$(header "$out" | jq -c .excluded)" '{"assigned":1,"draft":1,"label":1,"linked_pr":1,"skip_file":1}'
check skip_file_removes_1007 "$(numbers "$out")" '[1001,1008,1009]'

# pr_fields
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d")
check pr_fields "$(printf '%s\n' "$out" | jq -c 'select(.number==1009) | [.kind, .review_decision]')" '["pr","REVIEW_REQUIRED"]'

# adhoc_since_days
d=$(fresh_dir)
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d" --since 7d)
check adhoc_since_days "$(header "$out" | jq -c '[.mode, .cutoff]')" '["adhoc","2026-11-20T12:00:00Z"]'
check adhoc_lower_bound_local "$(numbers "$out")" '[1007,1008,1009]'

# first_run_default
d=$(fresh_dir)
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d")
check first_run_default "$(header "$out" | jq -c '[.mode, .cutoff]')" '["ordinary","2026-11-20T12:00:00Z"]'

# malformed_last_run
d=$(fresh_dir)
printf 'garbage\n' > "$d/last-run"
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d" 2>/dev/null); rc=$?
check malformed_last_run "$rc:$out" "3:"

# empty_last_run
: > "$d/last-run"
out=$(bash "$script" --input "$fixture" --now "$now" --state-dir "$d" 2>/dev/null); rc=$?
check empty_last_run "$rc:$out" "3:"

# truncated
jq '.[-1].data.search.issueCount += 1' "$fixture" > "$tmp/truncated.json"
d=$(fresh_dir)
out=$(bash "$script" --input "$tmp/truncated.json" --now "$now" --state-dir "$d" 2>/dev/null); rc=$?
check truncated "$rc:$out" "2:"

# missing_input
out=$(bash "$script" --input /nonexistent.json --now "$now" --state-dir "$d" 2>/dev/null); rc=$?
check missing_input "$rc" 1

# relative_state_dir_with_cdpath: CDPATH must not leak into the resolved path
d=$(fresh_dir)
printf '2026-11-20T00:00:00Z\n' > "$d/last-run"
out=$(cd "$(dirname "$d")" && CDPATH=. bash "$script" --input "$fixture" --now "$now" --state-dir "$(basename "$d")")
check relative_state_dir_with_cdpath "$(header "$out" | jq -c '[.cutoff, (.state_dir | contains("\n"))]')" '["2026-11-20T00:00:00Z",false]'

# worktree_state_dir
repo="$tmp/repo"
git init -q "$repo"
git -C "$repo" -c user.name=t -c user.email=t@example.com commit -q --allow-empty -m init
git -C "$repo" worktree add -q "$tmp/wt" -b wt-branch
expected=$(cd "$repo" && pwd -P)/.claude/triage
out=$(cd "$tmp/wt" && env -u QUARTO_TRIAGE_DIR bash "$script" --input "$fixture" --now "$now")
actual=$(header "$out" | jq -r .state_dir)
check worktree_state_dir "$actual" "$expected"

[ "$fails" -eq 0 ] || { echo "$fails check(s) failed"; exit 1; }
echo "all checks passed"
