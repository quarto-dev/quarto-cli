> A Claude Code skill can drive this checklist interactively: run `/make-release` (see `.claude/skills/make-release/`). It reads this file, verifies real `git`/`gh` state at each step, and pauses for confirmation before irreversible actions. This checklist stays the source of truth — the skill just follows it.

# First stable release of a new major.minor

A first stable release promotes the newest `v1.x` prerelease build to stable without rebuilding it, cuts the `v1.x` branch from that build's tag, and moves `main` to the next minor. Placeholders used throughout:

| Placeholder | Meaning | Example (Nov 2026) |
|---|---|---|
| `1.x` | the minor released as stable | `1.11` |
| `1.y` | the next minor, `main` after this release | `1.12` |
| `v1.x.N` | the prerelease build promoted to stable | `v1.11.9` |
| `v1.y.0` | the first `1.y` prerelease, built in step 5 | `v1.12.0` |
| `1.w.P` | the current stable, replaced by this release | `1.10.20` |


- Steps marked **GATE** change shared state (push, dispatch, release edit, tag, publish).
- `upstream` is the quarto-dev remote, `origin` your fork. Release work is never pushed to a fork. In `quarto-cli-pypi` there is no fork: `origin` is quarto-dev.
- Do each repo's edits in a fresh worktree on the remote branch, not in a clone checked out on another branch. Before every push, fetch and check that the remote branch has not moved since you based your work on it.
- Pass every `workflow_dispatch` input explicitly, and identify the run you started by its creation time, not as "the latest run".

## 1. Preflight

- [ ] The release to promote is the newest `v1.x.*` prerelease on GitHub, and `upstream/main` is exactly its tag commit. The tag commit is the `Update version.txt` commit the build adds on top of the source commit: it changes only `version.txt`. If `main` moved past it, stop: the release owner decides whether the new commits ship in 1.x (then build a new prerelease and restart) or wait for 1.y.
- [ ] CI is green, queried by commit:
  - on the tag's parent (the source commit): Build Installers, Bundle Test, Feature-Format Tests, Parallel Smokes Tests, Performance Check, Test quarto-latexmk;
  - on the tag commit: Smoke Tests (Built Version) - nightly.

  Stop if any is missing, pending, cancelled or failed.
- [ ] The release has the same non-zero asset count as the previous `v1.x.*` prerelease.
- [ ] `news/changelog-1.x.md` exists on `main` with its `## Regression fixes` and feature sections (content review happens in the changelog prep PR before this checklist).

## 2. Prepare the `v1.x` branch (local)

- [ ] Create it from the promoted tag, not from `main`: `git checkout -b v1.x v1.x.N`.
- [ ] Set `CITATION.cff` `version` (quoted: `"1.x"`; unquoted `1.10`-style values parse as a YAML float and lose the trailing zero) and `date-released` (the day you relabel the release in step 5). Commit as `Update CITATION.cff for v1.x`. `main` gets a cherry-pick of this commit (step 9), not a re-edit.
- [ ] Seed the backports scaffold in `news/changelog-1.x.md`: wrap the existing body under `# v1.x changes` and prepend `# v1.y backports` with empty `## In this release` and `## In previous releases`. The file then starts with `# v1.y backports`, `## In this release`, `## In previous releases`, `# v1.x changes`, `All changes included in 1.x:`, `## Regression fixes`. Commit as `[release checklist] Seed v1.y backports scaffold in changelog-1.x`. Backported PRs land under `## In this release` (`checklist-backport-a-pr.md`); the monthly patch release demotes them to `## In previous releases` (`checklist-make-a-new-stable-quarto-release.md`). Without this scaffold, later backports get mis-filed under the frozen `## Regression fixes`.

## 3. Prepare `main` (local)

- [ ] On a branch from `upstream/main`, set `QUARTO_VERSION` in `configuration` to `1.y` and commit as `[release checklist] QUARTO_VERSION -> 1.y`.
- [ ] Cherry-pick the CITATION commit from `v1.x` with `git cherry-pick -x`.

## 4. GATE: push the branch and the version bump

- [ ] `git push upstream v1.x`
- [ ] Push only the version bump commit to `main`: `git push upstream <bump-sha>:refs/heads/main`. Keep the CITATION commit local until step 9, after the relabel date is final.

## 5. GATE: build the 1.y prerelease, then relabel 1.x.N as stable

Order matters. quarto-web's `update-downloads.yml` and `publish.yml` both use the newest GitHub release marked pre-release. Relabelling 1.x.N before a 1.y prerelease exists makes that an older 1.x build: update-downloads then fails every 15 minutes (its version guard refuses to go backwards) and never updates the download page, and any quarto-web push publishes the site with the older prerelease.

- [ ] Dispatch the build and wait for success:
  `gh workflow run create-release.yml --repo quarto-dev/quarto-cli --ref main -f publish-release=true -f pre-release=true -f os=all -f smoke-artifacts-only=false -f skip-auto-smoke=false`
  The run must be on the bump commit.
- [ ] A single update-downloads failure, `an empty pre-release was detected`, is expected if its cron fires while the build uploads assets. It writes nothing.
- [ ] Check that `v1.y.0` is listed as a Pre-release with the full asset count.
- [ ] Only then relabel: `gh release edit v1.x.N --repo quarto-dev/quarto-cli --prerelease=false --latest` (web UI: edit the release, uncheck "Set as pre-release", check "Set as latest release"). Check that the latest release is now `v1.x.N` and the newest pre-release is `v1.y.0`. Note the date (UTC): `CITATION.cff` must carry it (step 9).

## 6. quarto-web: release-candidate profile flip

- [ ] Look at `profile: group:` in quarto-web `_quarto.yml` on `main`. `[prerelease, rc]`: there was no RC phase, so skip this step. `[rc, prerelease]`: change it to `[prerelease, rc]` and **GATE** push to `main`. The release merge in step 9 must keep this change.

## 7. quarto-web: downloads and site

- [ ] **GATE** Trigger update-downloads instead of waiting for its 15-minute cron: `gh workflow run update-downloads.yml --repo quarto-dev/quarto-web --ref main`. The run re-rendered the sites only if its `publish-changes-release` and `publish-changes-prerelease` jobs ran and succeeded. If they were skipped, the run saw no change: check step 5 and trigger again.
- [ ] https://quarto.org/docs/download/_download.json shows `1.x.N` and `_prerelease.json` shows `1.y.0`. (The `generator` meta tag on quarto.org shows the prerelease the site was built with, not the stable.)
- [ ] In a browser, https://quarto.org/docs/get-started/ links to 1.x.N and https://quarto.org/docs/download/prerelease.html links to 1.y.0 (the links are filled in by JavaScript).
- [ ] That run opens an automated PR **Update reference pages (prerelease)** on quarto-web `prerelease`, bumping `docs/cli/cli-info.json` to 1.y.0. **Do not merge it before step 10**: merged earlier, the release merge would ship the development CLI reference as stable.

## 8. quarto-web `prerelease`: highlights and release notes

- [ ] Highlights, in one commit (`Add v1.y prerelease highlights placeholder`):
  - `docs/prerelease/1.y/index.qmd`: copy of `docs/prerelease/1.x/index.qmd` with the title `Quarto 1.y Pre-Release`;
  - `docs/prerelease/1.y/_highlights.qmd`: the line `Quarto v1.y was just released, nothing to see here -- yet!`;
  - `docs/prerelease/_highlights-prerelease.qmd`: include `/docs/prerelease/1.y/_highlights.qmd`;
  - `docs/prerelease/_highlights-release.qmd`: include `/docs/prerelease/1.x/_highlights.qmd`.
- [ ] Wait until update-downloads has synced the download JSONs to `prerelease` (commit `Sync generated download redirects from main`), and rebase onto it. `docs/download/_download.json` and `_prerelease.json` must show 1.x.N and 1.y.0 locally: the script below reads them.
- [ ] Run `_tools/release-notes.R` with the R version pinned in `renv.lock`, e.g. `rig run --r-version <version> _tools/release-notes.R` (fresh worktree: `rig run --r-version <version> -e "renv::restore(prompt = FALSE)"` first; your default R may lack the packages). It must print `Release: 1.w.P -> 1.x.N` and `Prerelease: 1.x -> 1.y`; stop otherwise. Expected changes, nothing else:
  - `_quarto.yml` `version: '1.x'`, `_quarto-prerelease-docs.yml` `version: '1.y'`;
  - aliases `changelog/1.x/` in `docs/download/release.qmd` and `changelog/1.y/` in `docs/download/prerelease.qmd`;
  - a `1.w.P` entry in `docs/download/_download-older.yml`;
  - new `docs/download/changelog/1.w/{_changelog.md,index.qmd}`.

  Commit as `Run _tools/release-notes.R for the v1.x release`.
- [ ] **GATE** Push to `prerelease` and wait for its Quarto Publish run to succeed.

## 9. quarto-web: merge `prerelease` into `main`; CITATION on quarto-cli

- [ ] Drift check: find commits on quarto-web `main` that never reached `prerelease` (direct pushes, failed auto-backports) and cherry-pick genuine fixes onto `prerelease` first. Match by `cherry picked from commit` trailers, then by subject or PR number for squashed backports (`git log --cherry-pick` over-reports those). Ignore bot commits (`Apply automatic changes`, `Update the axe accessibility report`).
- [ ] In a worktree on `upstream/main`, `git merge upstream/prerelease`. Resolve conflicts:
  - `_axe-report.md`: keep `main`;
  - `docs/cli/cli-info.json`: keep `prerelease` if its `version` is `1.x.N`, else regenerate it with `quarto dev-call cli-info` from a 1.x.N binary;
  - everything else (`_quarto.yml`, pages, `_axe-baseline.json`, `_freeze/`): keep `prerelease`, including deletions (a `_freeze/` entry follows its page). Exception: if step 6 flipped the profile group, keep `main`'s `[prerelease, rc]`.

  After committing, the merge must differ from `prerelease` only in `_axe-report.md` (and the step-6 profile line, if any); anything else is drift the check missed. `_quarto.yml` `version` must be `'1.x'`.
- [ ] **GATE** Push to `main` (direct push; it does not trigger `port-to-prerelease.yml`), wait for Quarto Publish to succeed.
- [ ] **GATE** Refresh the accessibility reports: `gh workflow run axe-report.yml --repo quarto-dev/quarto-web --ref main`.
- [ ] **GATE** CITATION on quarto-cli `main`. If the relabel happened on a different date than the one in `CITATION.cff`, do not amend: add a commit `Update CITATION.cff release date for v1.x` on `v1.x`, push it, and cherry-pick it with `-x` too. Rebase onto `upstream/main` (it gained an `Update version.txt` commit from the 1.y build, as expected) and push.

## 10. quarto-web: merge back, tag, reference pages

- [ ] **GATE** Merge `main` into `prerelease` (normally a fast-forward), push, wait for Quarto Publish to succeed.
- [ ] **GATE** Tag quarto-web `main` to mark when the new site went live: `git tag -a v1.x -m "v1.x" upstream/main && git push upstream v1.x`. It needs only the step 9 push to `main`; it does not wait for the `prerelease` publish.
- [ ] On both `main` and `prerelease`: `_quarto.yml` `version` is `'1.x'`, `_quarto-prerelease-docs.yml` `version` is `'1.y'`.
- [ ] **GATE** Any time after the merge-back push, merge the **Update reference pages (prerelease)** PR (squash, subject `Update reference pages for prerelease v1.y.0`); it can wait until packaging is done. If no such PR is open, start it with `gh workflow run update-prerelease-reference.yml --repo quarto-dev/quarto-web --ref main -f version=1.y.0` and merge the PR it opens.
- [ ] Publish the release announcement post on the Posit Open Source site (opensource.posit.co; since the June 2026 blog migration it is not a quarto-web PR, and `quarto-web/docs/blog/posts` only redirects there). Date it with the actual release date.
- [ ] Announce in the #quarto Slack channel, linking the post (its preview while the post is still in review).

## 11. Packaging and package managers

- [ ] **GATE** Chocolatey, once `_download.json` shows 1.x.N: `gh workflow run build-and-publish-choco.yaml --repo quarto-dev/quarto-release-bundles --ref main -f publish=true`. The run log shows `CHOCO_NEW_VERSION` 1.x.N and the repo gets a `New quarto version 1.x.N` commit. Chocolatey then emails the maintainer; no action needed.
- [ ] **GATE** PyPI, in quarto-dev/quarto-cli-pypi: set `version.txt` to `1.x.N` (no `v`, trailing newline), commit as `Bump version from 1.w.P to 1.x.N`, push to `main`, then `gh workflow run 'Publish Quarto PyPi' --repo quarto-dev/quarto-cli-pypi --ref main -f publish-release=true`. Check https://pypi.org/project/quarto-cli/ shows 1.x.N.
  - Optional rehearsal: `-f publish-release=false` publishes to test.pypi only; test with `python3 -m pip install --index-url https://test.pypi.org/ --extra-index-url https://pypi.org/ quarto-cli` (the first try may report the package not found; the second succeeds).
- [ ] **GATE** Cloudsmith: **not auto-published for a first stable release**, because the relabelled prerelease build skipped its auto-publish job ([why](cloudsmith-publishing.md#first-stable-release-of-a-cycle); later patch releases auto-publish).
  - Dry run (no gate), must conclude `success`: `gh workflow run publish-cloudsmith.yml --repo quarto-dev/quarto-cli --ref main -f version=v1.x.N -f dry-run=true`
  - Production: same with `-f dry-run=false`. Its log shows four `Created: posit/open/quarto-...` packages (deb and rpm, two architectures each).
- [ ] Automatic, spot-check within a day:
  - conda-forge: an automated PR updates <github.com/conda-forge/quarto-feedstock>. Community maintained; we are assigned as reviewers and may help if it has issues.
  - Winget: a bot opens a PR in <github.com/microsoft/winget-pkgs/>. Community maintained.
  - Scoop: updated automatically in the manifests repo. Maintained as a personal project by @cderv.
  - Homebrew: a bot updates the cask <https://github.com/Homebrew/homebrew-cask/blob/master/Casks/q/quarto.rb>.

## 12. Clean up

- [ ] Remove the release worktrees and their local branches once each is clean and its `HEAD` is contained in the remote branch it was pushed to (`git merge-base --is-ancestor HEAD upstream/<branch>`). Then `git worktree remove`, and `git branch -D` (`-d` compares against your current branch, not the remote, so it can refuse a pushed branch). Keep the `v1.x` worktree if you use one for backports.
