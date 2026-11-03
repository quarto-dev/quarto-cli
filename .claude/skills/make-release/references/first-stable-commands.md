# First stable release: exact commands

Companion to `dev-docs/checklist-make-a-new-quarto-release.md`, keyed by its section numbers. The checklist says what to do and when to stop. This file gives the commands that do and check it. Run them in bash (Git Bash on Windows). When the checklist and this file disagree, the checklist wins: report the mismatch.

## Variables

They hold the checklist's placeholders: `REL` = `1.x`, `NEXT` = `1.y`, `TAG` = `v1.x.N`, `NEXTTAG` = `v1.y.0`, `PREV` = `1.w.P`. Ask the user for the three clone paths and a temp dir if you don't know them. Write this block to a file in the temp dir and `source` it at the start of every tool call (shell variables do not survive between calls). Append each value captured later (`ASSETS`, `BUMP`, `CIT`, `NEXTTAG`, `RELDATE`) to the same file.

```bash
export MSYS_NO_PATHCONV=1                 # Git Bash: keep "ref:path" and "/..." arguments intact
REL=<1.x>; NEXT=<1.y>                    # checklist placeholders 1.x and 1.y, e.g. REL=1.12 NEXT=1.13
QC='<quarto-cli clone>'; QW='<quarto-web clone>'; PYPI='<quarto-cli-pypi clone>'; SCRATCH='<temp dir>'
TAG=<v1.x.N>      # resolve ONCE in step 1 (query below) and write the literal: after step 5 it is no longer a prerelease
STABLE=${TAG#v}
PREV=<1.w.P>      # checklist placeholder 1.w.P, the current stable: curl -s https://quarto.org/docs/download/_download.json | jq -r .version, read BEFORE step 5
V="$QC.worktrees/v$REL"; W="$QC.worktrees/release-main-$NEXT"
P="$QW.worktrees/release-$REL-prerelease"; M="$QW.worktrees/release-$REL-main"; Y="$PYPI.worktrees/release-$STABLE"
```

Quote every path variable (`"$QC"`): clone paths may contain spaces.

## Shared patterns

Guarded push of worktree `<wt>` to branch `<b>` on remote `<r>` (`upstream`, or `origin` for quarto-cli-pypi):

```bash
git -C "<wt>" fetch <r>
git -C "<wt>" merge-base --is-ancestor <r>/<b> HEAD || { echo "STOP: <r>/<b> moved"; exit 1; }
git -C "<wt>" push <r> HEAD:<b>
git -C "<wt>" ls-remote --heads <r> <b>      # must equal: git -C "<wt>" rev-parse HEAD
```

On STOP: do not push. Report what landed on `<r>/<b>` (`git -C "<wt>" log --oneline HEAD..<r>/<b>`) and ask whether to rebase or re-merge.

Dispatch and capture (never "the latest run" without the time filter):

```bash
T0=$(date -u +%FT%TZ); gh workflow run <workflow> --repo <repo> --ref main <inputs>
gh run list --repo <repo> --workflow <workflow> --limit 5 --json databaseId,createdAt,headSha,event \
  --jq "map(select(.createdAt >= \"$T0\" and .event == \"workflow_dispatch\"))"   # empty: retry; still empty after 2 minutes: stop and report
gh run watch <id> --repo <repo> --exit-status   # run_in_background, act on the notification
```

quarto-web build check after pushing `<sha>` to `<b>`:

```bash
gh run list --repo quarto-dev/quarto-web --workflow publish.yml --branch <b> --limit 5 --json databaseId,headSha,status,conclusion
# take the run whose headSha == <sha>, then gh run watch <id> --repo quarto-dev/quarto-web --exit-status
```

quarto.org is served by Netlify; a JSON or page check right after a successful deploy can lag by a few minutes. Recheck once after 5 minutes before stopping.

## 1. Preflight

Resolve the promoted tag, then write its literal value into the variables file:

```bash
gh release list --repo quarto-dev/quarto-cli --limit 30 --json tagName,isPrerelease \
  --jq ".[]|select(.isPrerelease and (.tagName|startswith(\"v$REL.\")))|.tagName" | head -1
```

```bash
git -C "$QC" fetch upstream --tags
git -C "$QC" rev-parse upstream/main "$TAG^{commit}"               # identical
git -C "$QC" diff --name-only "$TAG^{commit}~1" "$TAG^{commit}"    # only version.txt
for c in $(git -C "$QC" rev-parse "$TAG^{commit}~1" "$TAG^{commit}"); do echo "== $c"
  gh run list --repo quarto-dev/quarto-cli --commit $c --limit 100 --json name,status,conclusion,createdAt \
    --jq 'sort_by(.createdAt)|reverse|unique_by(.name)|.[]|"\(.status) \(.conclusion) \(.name)"'; done
```

`unique_by(.name)` keeps the newest run per workflow, so a successful rerun replaces an earlier failure. Every workflow the checklist names must print `completed success`; `skipped` counts as missing.

```bash
for t in $(gh release list --repo quarto-dev/quarto-cli --limit 30 --json tagName --jq ".[].tagName|select(startswith(\"v$REL.\"))" | head -2); do
  echo "$t $(gh release view $t --repo quarto-dev/quarto-cli --json assets --jq '.assets|length')"; done
ASSETS=$(gh release view "$TAG" --repo quarto-dev/quarto-cli --json assets --jq '.assets|length')
git -C "$QC" show "upstream/main:news/changelog-$REL.md" | grep -n '^## Regression fixes'
```

Only one tag printed (no earlier `v$REL.*` prerelease): compare `$ASSETS` with the last `v$PREV` minor's first prerelease instead and report both numbers.

## 2–3. Local preparation

```bash
git -C "$QC" worktree add "$V" "$TAG" -b "v$REL"
sed -i -E "s/^version: .*/version: \"$REL\"/; s/^date-released: .*/date-released: $(date -u +%F)/" "$V/CITATION.cff"
git -C "$V" diff                                   # exactly the two lines
git -C "$V" commit -am "Update CITATION.cff for v$REL"
# scaffold: edit news/changelog-$REL.md, then
git -C "$V" commit -am "[release checklist] Seed v$NEXT backports scaffold in changelog-$REL"
git -C "$V" log --oneline "$TAG..HEAD"             # exactly 2 commits
head -11 "$V/news/changelog-$REL.md"
```

Expected head, exactly, with `1.x` and `1.y` replaced by the real versions (line 9 already exists in the changelog; keep it):

```
# v1.y backports

## In this release

## In previous releases

# v1.x changes

All changes included in 1.x:

## Regression fixes
```

```bash
git -C "$QC" worktree add "$W" upstream/main -b "release/main-$NEXT" --no-track
sed -i "s/^export QUARTO_VERSION=.*/export QUARTO_VERSION=$NEXT/" "$W/configuration"
git -C "$W" diff                                   # exactly the QUARTO_VERSION line
git -C "$W" commit -am "[release checklist] QUARTO_VERSION -> $NEXT"
CITV=$(git -C "$V" log --format=%H --fixed-strings --grep="Update CITATION.cff for v$REL" "$TAG..HEAD")
git -C "$W" cherry-pick -x $CITV
BUMP=$(git -C "$W" log --format=%H --fixed-strings --grep="[release checklist] QUARTO_VERSION -> $NEXT" upstream/main..HEAD)
CIT=$(git -C "$W" log --format=%H --fixed-strings --grep="Update CITATION.cff for v$REL" upstream/main..HEAD)
git -C "$W" show --stat --format=%s $BUMP     # configuration only
git -C "$W" show --stat --format=%s $CIT      # CITATION.cff only
```

## 4. Pushes

```bash
git -C "$V" push upstream "v$REL"
git -C "$QC" ls-remote --heads upstream "v$REL"    # = git -C "$V" rev-parse HEAD
git -C "$W" fetch upstream
git -C "$W" merge-base --is-ancestor upstream/main $BUMP || { echo "STOP: main moved"; exit 1; }
git -C "$W" push upstream $BUMP:refs/heads/main
git -C "$QC" ls-remote --heads upstream main       # = $BUMP
```

On STOP: main gained commits since step 1, so the promoted tag is no longer main's head. Report them; the release owner decides (checklist step 1).

## 5. Build, then relabel

Dispatch `create-release.yml` with the five inputs from the checklist (dispatch and capture). Stop unless `headSha == $BUMP` and `event == workflow_dispatch`. If the run fails, stop: no relabel.

During the build, list update-downloads runs: `gh run list --repo quarto-dev/quarto-web --workflow update-downloads.yml --limit 5 --json databaseId,conclusion,createdAt`. A failure is the expected one only if its log contains `an empty pre-release was detected` (`gh run view <id> --repo quarto-dev/quarto-web --log-failed | grep 'empty pre-release'`). Any other failure: stop and report.

```bash
NEXTTAG=$(gh release list --repo quarto-dev/quarto-cli --limit 5 --json tagName,isPrerelease \
  --jq ".[]|select(.isPrerelease and (.tagName|startswith(\"v$NEXT.\")))|.tagName" | head -1)
[ -n "$NEXTTAG" ] || { echo "STOP: no v$NEXT prerelease"; exit 1; }
gh release view "$NEXTTAG" --repo quarto-dev/quarto-cli --json isPrerelease,assets --jq '"\(.isPrerelease) \(.assets|length)"'
# relabel only after the line above prints "true $ASSETS":
gh release edit "$TAG" --repo quarto-dev/quarto-cli --prerelease=false --latest
RELDATE=$(date -u +%F)
gh api repos/quarto-dev/quarto-cli/releases/latest --jq .tag_name                                   # = $TAG
gh api 'repos/quarto-dev/quarto-cli/releases?per_page=10' --jq 'map(select(.prerelease))[0].tag_name'  # = $NEXTTAG
```

## 6. Profile group

```bash
git -C "$QW" fetch upstream && git -C "$QW" show upstream/main:_quarto.yml | grep -A1 '^  group:'
```

Only if the second line is `    - [rc, prerelease]`:

```bash
git -C "$QW" worktree add "$M" upstream/main -b "release/$REL-main" --no-track
sed -i 's/^    - \[rc, prerelease\]$/    - [prerelease, rc]/' "$M/_quarto.yml"
git -C "$M" diff                                   # exactly that line
git -C "$M" commit -am "Flip profile group to [prerelease, rc] for v$REL"
```

Guarded push `$M` to `main`, then the build check. Step 9 reuses this worktree.

## 7. Downloads and site

```bash
gh run view <update-downloads id> --repo quarto-dev/quarto-web --json jobs --jq '.jobs[]|"\(.conclusion) \(.name)"'
```

Expect `success` for `update-downloads`, `publish-changes-release / build-deploy`, `publish-changes-prerelease / build-deploy`, and for `update-prerelease-reference / update-reference` (it opens the reference PR). If the `publish-changes-*` jobs are skipped, an earlier cron run may already have published: list `gh run list --repo quarto-dev/quarto-web --workflow update-downloads.yml --limit 5 --json databaseId,conclusion,createdAt` and check the jobs of each run, newest first, for succeeded `publish-changes-*` jobs; a cron run that started just before the relabel can still have published. Accept it only if `_download.json` and `_prerelease.json` then show the new versions. None found: dispatch once more; still skipped: stop and report.

```bash
curl -s https://quarto.org/docs/download/_download.json | jq -r .version     # = $STABLE
curl -s https://quarto.org/docs/download/_prerelease.json | jq -r .version   # = ${NEXTTAG#v}
gh pr list --repo quarto-dev/quarto-web --base prerelease --search 'Update reference pages in:title' --json number,title --jq '.[]|"\(.number) \(.title)"'
```

The browser link check: use `agent-browser` if available, else ask the user to look. Expected: a download link on get-started contains `/releases/download/$TAG/`; one on the prerelease page contains `/releases/download/$NEXTTAG/`.

## 8. quarto-web prerelease

```bash
git -C "$QW" worktree add "$P" upstream/prerelease -b "release/$REL-prerelease" --no-track
mkdir -p "$P/docs/prerelease/$NEXT"
sed "s/Quarto $REL Pre-Release/Quarto $NEXT Pre-Release/" "$P/docs/prerelease/$REL/index.qmd" > "$P/docs/prerelease/$NEXT/index.qmd"
printf '%s\n' "Quarto v$NEXT was just released, nothing to see here -- yet!" > "$P/docs/prerelease/$NEXT/_highlights.qmd"
sed -i -E "s#/docs/prerelease/[0-9.]+/_highlights.qmd#/docs/prerelease/$NEXT/_highlights.qmd#" "$P/docs/prerelease/_highlights-prerelease.qmd"
sed -i -E "s#/docs/prerelease/[0-9.]+/_highlights.qmd#/docs/prerelease/$REL/_highlights.qmd#" "$P/docs/prerelease/_highlights-release.qmd"
git -C "$P" diff; git -C "$P" status --short       # one include line changed in each file, two new files
git -C "$P" add docs/prerelease && git -C "$P" commit -m "Add v$NEXT prerelease highlights placeholder"
```

After step 7, wait for the sync commit (check every 10 minutes; not there an hour after the update-downloads run: stop and report):

```bash
git -C "$P" fetch upstream
git -C "$P" log -1 --format='%h %ad %s' upstream/prerelease --fixed-strings --grep='Sync generated download redirects from main'   # dated after the relabel
git -C "$P" rebase upstream/prerelease
jq -r .version "$P/docs/download/_download.json" "$P/docs/download/_prerelease.json"       # $STABLE, ${NEXTTAG#v}
jq -r .R.Version "$P/renv.lock"
```

Run R from PowerShell with that R version, with a literal path. Bare `quarto run` or `Rscript` uses the default R, which may lack the packages (v1.11: `there is no package called 'fs'`). Without rig, use the matching R installation's `Rscript` the same way.

```powershell
Set-Location '<P path>'
rig run --r-version <version> -e "renv::restore(prompt = FALSE)"
rig run --r-version <version> _tools/release-notes.R
```

```bash
git -C "$P" status --short       # only the files the checklist lists
grep -n '^version' "$P/_quarto.yml" "$P/_quarto-prerelease-docs.yml"
grep -n 'changelog/' "$P/docs/download/release.qmd" "$P/docs/download/prerelease.qmd"
grep -n -A2 "$PREV" "$P/docs/download/_download-older.yml"
```

Any other changed file (for example under `renv/`): do not stage it; report it.

## 9. Release merge

The quarto-web merge (drift check, `cli-info.json` check, merge and resolve, push to `main`) belongs to quarto-web's `release-merge` skill. It is not installed in a quarto-cli session, so read it from the clone:

```bash
git -C "$QW" fetch upstream
git -C "$QW" show upstream/main:.claude/skills/release-merge/SKILL.md
git -C "$QW" show upstream/main:.claude/skills/release-merge/references/release-merge.md
```

Follow it with the variables file sourced: it uses the same names (`REL`, `TAG`, `STABLE`, `QW`, `SCRATCH`, `P`, `M`). Take the direct-push merge path, the checklist default. Its pushes to `prerelease` and `main` are GATEs. Come back here after its build check on `main` succeeds.

CITATION on quarto-cli:

```bash
grep date-released "$V/CITATION.cff"                  # must equal $RELDATE
# if it differs:
sed -i -E "s/^date-released: .*/date-released: $RELDATE/" "$V/CITATION.cff"
git -C "$V" commit -am "Update CITATION.cff release date for v$REL"
# guarded push $V to v$REL (GATE), then:
DATEFIX=$(git -C "$V" log -1 --format=%H --fixed-strings --grep="Update CITATION.cff release date for v$REL")
git -C "$W" cherry-pick -x $DATEFIX
# always:
git -C "$W" fetch upstream && git -C "$W" rebase upstream/main
git -C "$W" log --oneline upstream/main..HEAD           # only the CITATION commit(s)
# guarded push $W to main, then:
gh api 'repos/quarto-dev/quarto-cli/contents/CITATION.cff?ref=main' -H 'Accept: application/vnd.github.raw' | grep -E '^(version|date-released)'
```

## 10. Merge back, tag, reference pages

```bash
git -C "$P" fetch upstream && git -C "$P" merge --ff-only upstream/main || { echo "STOP: not a fast-forward"; exit 1; }
```

Not a fast-forward means `prerelease` got commits after the release merge: list them (`git -C "$P" log --oneline upstream/main..upstream/prerelease`) and ask before a real merge. Then guarded push `$P` to `prerelease` and the build check.

The tag does not wait for the `prerelease` publish:

```bash
git -C "$QW" fetch upstream && git -C "$QW" tag -a "v$REL" -m "v$REL" upstream/main && git -C "$QW" push upstream "v$REL"
git -C "$QW" ls-remote --tags upstream "v$REL"
for b in main prerelease; do for f in _quarto.yml _quarto-prerelease-docs.yml; do
  echo "$b $f $(git -C "$QW" show upstream/$b:$f | grep -m1 '^version')"; done; done
```

Axe report, after the merge-back push: dispatch and capture `axe-report.yml` (no inputs); stop on failure. It commits `_axe-report.md` to `main` and `prerelease` separately; that is expected.

Reference PR, any time after the merge-back push (v1.11 merged it after packaging):

```bash
N=$(gh pr list --repo quarto-dev/quarto-web --base prerelease --search 'Update reference pages in:title' --json number --jq '.[0].number')
gh pr checks "$N" --repo quarto-dev/quarto-web --watch      # wait for its checks
gh pr merge "$N" --repo quarto-dev/quarto-web --squash --subject "Update reference pages for prerelease $NEXTTAG"
git -C "$QW" fetch upstream && git -C "$QW" show upstream/prerelease:docs/cli/cli-info.json | jq -r .version   # ${NEXTTAG#v}
```

`gh pr merge` refused (branch protection, required review): stop and ask the user to merge it.

## 11. Packaging

```bash
gh run view <choco id> --repo quarto-dev/quarto-release-bundles --log | grep CHOCO_NEW_VERSION
gh api 'repos/quarto-dev/quarto-release-bundles/commits?per_page=1' --jq '.[0].commit.message'

git -C "$PYPI" fetch origin
git -C "$PYPI" worktree add "$Y" origin/main -b "release/$STABLE" --no-track
OLD=$(cat "$Y/version.txt"); printf '%s\n' "$STABLE" > "$Y/version.txt"
git -C "$Y" commit -m "Bump version from $OLD to $STABLE" version.txt
# guarded push $Y to main on origin, then dispatch and capture:
#   gh workflow run 'Publish Quarto PyPi' --repo quarto-dev/quarto-cli-pypi --ref main -f publish-release=true
curl -s https://pypi.org/pypi/quarto-cli/json | jq -r .info.version     # = $STABLE (recheck once after 5 minutes)

gh run view <cloudsmith id> --repo quarto-dev/quarto-cli --log | grep -c 'Created: posit/open/quarto-'   # 4 on the real run
```

The Cloudsmith dry run passes when the run concludes `success`; it runs without a gate.

## 12. Clean up

Dry run first, show it, remove only after approval. The release branches were created `--no-track`, so `git branch -d` would compare against the clone's current branch, not the remote: check against the remote branch and delete with `-D`. Keep `$V` (the stable worktree, reused for backports).

```bash
for x in "$QC|$W|upstream/main" "$QW|$P|upstream/prerelease" "$QW|$M|upstream/main" "$PYPI|$Y|origin/main"; do
  IFS='|' read -r repo wt rb <<< "$x"; git -C "$wt" fetch -q "${rb%%/*}"
  b=$(git -C "$wt" branch --show-current)
  d=$(git -C "$wt" status --porcelain | wc -l)
  git -C "$wt" merge-base --is-ancestor HEAD "$rb" && m=merged || m=NOT-MERGED
  echo "$wt branch=$b dirty=$d $m"; done
# for each line with dirty=0 and merged, after approval:
#   git -C "<repo>" worktree remove "<wt>" && git -C "<repo>" branch -D "<branch>"
```
