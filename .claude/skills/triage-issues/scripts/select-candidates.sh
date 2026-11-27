#!/usr/bin/env bash
# List open quarto-cli issues and PRs created in a time window, minus the ones
# that need no triage. Prints JSON lines: one header, then one record per
# candidate. Needs only gh (authenticated) and jq. Never writes to the state dir.
#
# Usage: select-candidates.sh [--since <ISO8601|Nd>] [--skip-file <path>]
#          [--state-dir <dir>] [--input <search.json>] [--now <ISO8601>] [--table]
# Exit codes: 0 ok; 1 gh/network/input failure; 2 listing truncated; 3 usage
# error or malformed last-run/--since.
set -euo pipefail

# Git Bash rewrites POSIX-looking arguments passed to native programs (jq.exe, gh.exe); keep them literal.
export MSYS2_ARG_CONV_EXCL="*"

REPO="quarto-dev/quarto-cli"
ISO_RE='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'

die() { echo "select-candidates: $2" >&2; exit "$1"; }

since="" skip_file="" state_dir="" input="" now="" table=0
while [ $# -gt 0 ]; do
  case "$1" in
    --since|--skip-file|--state-dir|--input|--now)
      [ $# -ge 2 ] || die 3 "$1 needs a value"
      case "$1" in
        --since) since=$2 ;;
        --skip-file) skip_file=$2 ;;
        --state-dir) state_dir=$2 ;;
        --input) input=$2 ;;
        --now) now=$2 ;;
      esac
      shift 2 ;;
    --table) table=1; shift ;;
    *) die 3 "unknown argument: $1" ;;
  esac
done

# Normalize an ISO 8601 timestamp through jq; fails when it does not parse.
normalize_iso() {
  [[ $1 =~ $ISO_RE ]] || return 1
  jq -rn --arg t "$1" '$t | fromdateiso8601 | todate' 2>/dev/null
}

if [ -n "$now" ]; then
  start=$(normalize_iso "$now") || die 3 "--now is not an ISO 8601 UTC timestamp: $now"
else
  start=$(jq -rn 'now | floor | todate')
fi

# State directory: --state-dir, else $QUARTO_TRIAGE_DIR, else the main checkout's .claude/triage.
if [ -z "$state_dir" ]; then
  state_dir=${QUARTO_TRIAGE_DIR:-}
fi
if [ -z "$state_dir" ]; then
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) \
    || die 3 "not in a git repository; pass --state-dir or set QUARTO_TRIAGE_DIR"
  state_dir="$(cd "$(dirname "$common")" && pwd -P)/.claude/triage"
elif [ -d "$state_dir" ]; then
  state_dir=$(cd "$state_dir" && pwd -P)
fi

# Cutoff.
mode=ordinary
if [ -n "$since" ]; then
  mode=adhoc
  if [[ $since =~ ^([0-9]+)d$ ]]; then
    cutoff=$(jq -rn --arg s "$start" --argjson n "${BASH_REMATCH[1]}" \
      '($s | fromdateiso8601) - ($n * 86400) | todate')
  else
    [[ $since =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && since="${since}T00:00:00Z"
    cutoff=$(normalize_iso "$since") || die 3 "--since must be Nd or an ISO 8601 UTC timestamp: $since"
  fi
elif [ -e "$state_dir/last-run" ]; then
  last_run=$(tr -d '[:space:]' < "$state_dir/last-run")
  cutoff=$(normalize_iso "$last_run") || die 3 "malformed last-run file: $state_dir/last-run"
else
  cutoff=$(jq -rn --arg s "$start" '($s | fromdateiso8601) - (7 * 86400) | todate')
fi

# Skip file: numbers one per line; CR, blank lines and '#' comments ignored (parsed in jq).
skip_text=""
if [ -n "$skip_file" ]; then
  [ -f "$skip_file" ] || die 3 "skip file not found: $skip_file"
  skip_text=$(cat "$skip_file")
fi

# Fetch: array of GraphQL pages.
if [ -n "$input" ]; then
  [ -f "$input" ] || die 1 "input file not found: $input"
  pages=$(cat "$input")
else
  read -r -d '' query <<'GQL' || true
query($q: String!, $endCursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $endCursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on Issue {
        number title createdAt authorAssociation author { login }
        assignees(first: 1) { totalCount }
        labels(first: 100) { nodes { name } }
        comments { totalCount }
        closedByPullRequestsReferences(first: 1, includeClosedPrs: false) { totalCount }
      }
      ... on PullRequest {
        number title createdAt authorAssociation author { login }
        assignees(first: 1) { totalCount }
        labels(first: 100) { nodes { name } }
        comments { totalCount }
        isDraft reviewDecision
      }
    }
  }
}
GQL
  pages=$(gh api graphql --paginate --slurp -f query="$query" \
    -f q="repo:$REPO is:open created:>=$cutoff") || die 1 "gh api graphql failed"
fi

printf '%s' "$pages" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1 \
  || die 1 "listing is not a non-empty array of GraphQL pages"

# The search reports how many results exist; fewer fetched means a partial listing.
truncated=$(printf '%s' "$pages" | jq -r \
  '([.[].data.search.nodes | length] | add) < (.[-1].data.search.issueCount) ') \
  || die 1 "listing has an unexpected shape"
[ "$truncated" = "false" ] || die 2 "listing truncated: fewer results fetched than the search reports"

out=$(printf '%s' "$pages" | jq -c \
  --arg cutoff "$cutoff" --arg start "$start" --arg mode "$mode" \
  --arg state_dir "$state_dir" --arg skip "$skip_text" '
  ($cutoff | fromdateiso8601) as $lo
  | ($start | fromdateiso8601) as $hi
  | ($skip | split("\n") | map(gsub("#.*"; "") | gsub("[ \t\r]"; "")) | map(select(test("^[0-9]+$")) | tonumber)) as $skipped
  | ["duplicate","invalid","question","wontfix","needs-repro","stale","support"] as $blocking
  | [.[].data.search.nodes[] | select(. != null)
     | select((.createdAt | fromdateiso8601) as $t | $t >= $lo and $t < $hi)
     | . as $n
     | ([$n.labels.nodes[].name]) as $labels
     | { node: $n, labels: $labels,
         reason: (
           if $n.assignees.totalCount > 0 then "assigned"
           elif ($n.isDraft // false) then "draft"
           elif ($labels | any(. as $l | $blocking | index($l))) then "label"
           elif (($n.closedByPullRequestsReferences.totalCount // 0) > 0) then "linked_pr"
           elif ($skipped | index($n.number)) then "skip_file"
           else null end) }] as $items
  | { type: "header", cutoff: $cutoff, start: $start, mode: $mode, state_dir: $state_dir,
      excluded: ( {assigned:0, draft:0, label:0, linked_pr:0, skip_file:0}
                  + ([$items[] | select(.reason != null) | .reason] | group_by(.) | map({(.[0]): length}) | add // {}) ) },
    ( $items[] | select(.reason == null) | .node as $n
      | { type: "candidate", number: $n.number,
          kind: (if $n.__typename == "PullRequest" then "pr" else "issue" end),
          title: $n.title, author: ($n.author.login // null),
          author_association: $n.authorAssociation, labels: .labels,
          comments: $n.comments.totalCount, created_at: $n.createdAt,
          review_decision: ($n.reviewDecision // null) } )
') || die 1 "jq failed to process the listing"

if [ "$table" -eq 1 ]; then
  printf '%s\n' "$out" | jq -r '
    if .type == "header"
    then "mode \(.mode)  cutoff \(.cutoff)  start \(.start)  excluded \(.excluded | to_entries | map("\(.key)=\(.value)") | join(","))"
    else [.number, .kind, .author_association, (.review_decision // "-"), .comments, .created_at, .title] | @tsv end' \
    | if command -v column >/dev/null 2>&1; then column -t -s "$(printf '\t')"; else cat; fi
else
  printf '%s\n' "$out"
fi
