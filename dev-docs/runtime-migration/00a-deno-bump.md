# PR 00a: Bump Deno 2.7.14 to the newest 2.9.x

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quarto's bundled Deno moves from v2.7.14 to the newest 2.9.x release (v2.9.7 when this plan was written; use the newest 2.9.x at execution), with every place that names the version updated and the full test suite green.
**Phase:** 0. **Depends on:** 02 (landing order only: the ratchet must not move). **Unblocks:** 00b (the committed `deno.lock` is written by the new Deno, so its lockfile format does not change again), Spike #2 in `SPIKES.md` (the `node:` bundle and `node:http` + `ws` are tested on the Deno the dual-runtime window would ship), every Phase 2 plan that relies on Deno's Node compatibility.
**Branch:** `rt/00a-deno-bump`.
**Suggested executor:** Sonnet. The edits are four version strings and a changelog line; the judgement is in reading a failing CI bucket (a real 2.9 regression versus a flaky test), and the plan says how to tell them apart.
**Size:** S (5 files: `configuration`, `src/command/check/check.ts`, `.github/workflows/create-release.yml`, `dev-docs/upgrade-dependencies.md`, `news/changelog-1.11.md`).
**Ships on:** Deno 2.9.x; the existing test suite must stay green.

## Spec

### Context

`REVIEW-2026-10-15.md` S13 and section 5 ("00a"): `configuration` pins Deno v2.7.14; the current release line is 2.9 (v2.9.7, 2026-09-17, verified: `https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-unknown-linux-gnu.zip` resolves). Why the bump matters for the migration:

- Deno 2.8 raised Deno's pass rate on Node's own test suite from about 42% to 76%. It fixed the `node:http` `upgrade` wiring (denoland/deno#33342) and non-101 upgrade rejects (#32615), which PR 16 (`http.ts`), PR 29 (`ws` on `node:http`) and the dual-runtime window of decision 1 (the `node:` bundle running on Deno, Spike #2) depend on. 2.7.14 may predate both fixes.
- Deno 2.9 targets Node 26 compatibility (the Node major PR 33 pins) and adds `fs.glob` `followSymlinks`. Its known open issue denoland/deno#36937 (a recursive `fs.watch` gets no events after the watched directory is deleted and recreated) is a Spike #2 item, not a blocker for this PR: Quarto watches with `Deno.watchFs` today.
- Deno joined Cloudflare on 2026-10-09 and announced one more year of monthly bug-fix and security releases, then end of development. 2.9.x is therefore the line Quarto rides until PR 37; this PR is the last planned minor bump, later bumps are patch releases inside 2.9.
- Deno 2 removed `--lock-write` (the lockfile is updated unless `--frozen` is given). PR 00b depends on that behaviour; this PR does not touch lockfiles beyond what `configure` already does.

Every place the Deno version appears (verified with `rg -n '2\.7\.14|DENO=v'` and by reading the consumers of `configuration`):

| Place | What it holds | Change |
|---|---|---|
| `configuration:13` | `export DENO=v2.7.14` | `v2.9.7` (or newer 2.9.x) |
| `src/command/check/check.ts:305` | `[denoVersion, "2.7.14", "Deno"]` in `versionConstraints` | `"2.9.7"`; `tests/smoke/check/check-versions-no-mismatch.test.ts` fails until it matches `Deno.version.deno` |
| `.github/workflows/create-release.yml:236-239` (`make-tarball-rhel`, currently `if: false`) | conda-forge build hash `h6046fbb_0` in three places | the hash of `linux-64/deno-2.9.7-<hash>.conda`, per `dev-docs/upgrade-dependencies.md` "Upgrade Deno download link for RHEL build"; unchanged if conda-forge has no 2.9.7 build yet (the job stays disabled) |
| `package/conda-recipe/meta.yaml:2,18` | reads the version from `configuration` by regex | no edit; requires `deno 2.9.7` on conda-forge for conda builds (checked in Task 1) |
| `package/src/common/dependencies/deno.ts` | download URLs built from the version (`deno-<target>.zip`) | no edit; the five asset names are checked in Task 1 |
| `package/scripts/common/utils.sh:4-27`, `configure.cmd:50` | `DENOURL`, `DENOFILES` per platform | no edit (same asset names) |
| `package/scripts/common/quarto:76-89`, `package/scripts/windows/quarto.cmd:52-69` | compare `package/dist/config/deno-version` with `configuration` and re-run `configure` on mismatch | no edit; this is how developers pick up the bump |
| `.github/workflows/actions/quarto-dev/action.yml:19` | dev cache key hashes `configuration` | no edit; the bump invalidates the CI Deno cache automatically |
| `dev-docs/ci-deno-caching.md` | documents that key; names no version | no edit (verified: no version string) |
| `dev-docs/upgrade-dependencies.md:3` | says the check.ts table is at "~line 249" | point at the `versionConstraints` array instead of a line number |
| `news/changelog-1.11.md` | no `## Dependencies` section yet | add the section and the entry |

### Scope

In: the edits in the table, a local smoke run, the full CI suite, the installer dispatch that `dev-docs/upgrade-dependencies.md` requires for any bundled-binary bump.

Out: bumping `@std/*` versions in `src/import_map.json` (only if `configure` fails with `Module not found`, per `dev-docs/upgrade-dependencies.md`; record it in the PR if it happens); `deno.lock` (PR 00b); `deno_dom` (PR 05, PR 20).

### Interfaces

No TypeScript interface changes. `quarto check versions` reports `Deno version 2.9.7: OK` in strict mode.

### Files

- Modify: `configuration:13`
- Modify: `src/command/check/check.ts:305`
- Modify: `.github/workflows/create-release.yml:236-239` (if the conda-forge build exists)
- Modify: `dev-docs/upgrade-dependencies.md:3`
- Modify: `news/changelog-1.11.md` (new `## Dependencies` section after `## Regression fixes`)
- Modify: `dev-docs/runtime-migration/README.md` (PR 00a row status)
- Test: `tests/smoke/check/check-versions-no-mismatch.test.ts` (existing; it is the failing test of Task 2)

### Acceptance criteria

- `package/dist/bin/tools/x86_64/deno --version` (Linux x64; `aarch64` on Apple Silicon, `deno.exe` on Windows) prints `deno 2.9.7`.
- `package/dist/bin/quarto check versions` prints no `does not strictly match` line; `check-versions-no-mismatch.test.ts` passes.
- `git status --short` after `./configure.sh` shows only the files this PR edits (the `quarto-dev` action's "Basic dev mode sanity check" fails on any file `configure` modifies).
- On the PR: `Parallel Smokes Tests`, `Smoke Tests`, `Bundle Test`, `Test Tool Install`, `Runtime Boundary` green; a `create-release.yml` dispatch with `publish-release=false` on the branch has green `make-installer-mac` and `make-installer-win` jobs.

## Plan

### Task 1: Pick the version and confirm every artifact exists

**Files:** none

- [ ] **Step 1: Find the newest 2.9.x**

Run: `gh release list --repo denoland/deno --limit 20 | grep -E '^v2\.9\.' | head -1`
Expected: a line starting `v2.9.` (v2.9.7 when this plan was written). Use that version everywhere below; the plan writes `v2.9.7`.

- [ ] **Step 2: Confirm the five release assets Quarto downloads**

Run:
```bash
V=v2.9.7
for f in deno-x86_64-unknown-linux-gnu.zip deno-aarch64-unknown-linux-gnu.zip \
         deno-x86_64-apple-darwin.zip deno-aarch64-apple-darwin.zip deno-x86_64-pc-windows-msvc.zip; do
  printf '%s ' "$f"; curl -sIL -o /dev/null -w '%{http_code}\n' "https://github.com/denoland/deno/releases/download/$V/$f"
done
```
Expected: five lines ending in `200`.

- [ ] **Step 3: Check conda-forge**

Open `https://anaconda.org/conda-forge/deno/files` and look for `linux-64/deno-2.9.7-<hash>.conda`.
Expected: either the file exists (note `<hash>`, for example `h1a2b3c4_0`, for Task 3) or it does not (Task 3 is skipped and the PR description says so; `make-tarball-rhel` stays `if: false` and conda builds of this Quarto version wait for the feedstock).

### Task 2: Bump the version (the version-check test is the failing test)

**Files:**
- Modify: `configuration:13`
- Modify: `src/command/check/check.ts:305`

- [ ] **Step 1: Change `configuration` and reconfigure**

In `configuration` replace
```bash
export DENO=v2.7.14
```
with
```bash
export DENO=v2.9.7
```
Run: `./configure.sh` (Windows: `.\configure.cmd`)
Expected: `Bootstrapping Deno...` (the version file no longer matches), downloads, `quarto --version` at the end prints `99.9.9`. If it stops with `Module not found: jsr:/@std/...`, bump only the named `@std` entry in `src/import_map.json` to the version `https://jsr.io/@std/<name>` lists as compatible and re-run (procedure in `dev-docs/upgrade-dependencies.md`).

- [ ] **Step 2: Run the version-check test and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts`
Expected: FAIL; the captured output contains `Deno version 2.9.7 does not strictly match 2.7.14`.

- [ ] **Step 3: Update the check table**

In `src/command/check/check.ts` replace
```ts
    [denoVersion, "2.7.14", "Deno"],
```
with
```ts
    [denoVersion, "2.9.7", "Deno"],
```

- [ ] **Step 4: Run the test again**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts smoke/check/check.test.ts`
Expected: all passed.

- [ ] **Step 5: Confirm `configure` modified nothing else**

Run: `git status --short`
Expected: exactly ` M configuration` and ` M src/command/check/check.ts`. If `src/resources/deno_std/deno_std.lock` also shows as modified (the new Deno rewrote its lockfile format), inspect `git diff src/resources/deno_std/deno_std.lock`: when only the `"version"` field and layout changed and every resolved version is the same, commit it with this task; when a resolved version changed, revert it (`git checkout -- src/resources/deno_std/deno_std.lock`) and stop: that is a re-resolution `download.sh` must not do, report it in the PR.

- [ ] **Step 6: Commit**

```bash
git add configuration src/command/check/check.ts
git commit -m "Update Deno to v2.9.7

2.8 and 2.9 carry the Node-compatibility fixes (node:http upgrade
wiring, Node 26 targets) that the runtime migration's dual-runtime
window and Phase 2 rely on."
```

### Task 3: RHEL tarball hash and the upgrade doc

**Files:**
- Modify: `.github/workflows/create-release.yml:236-239`
- Modify: `dev-docs/upgrade-dependencies.md:3`

- [ ] **Step 1: Replace the conda-forge hash (skip if Task 1 Step 3 found no build)**

In `.github/workflows/create-release.yml`, step `Move Custom Deno`, replace `h6046fbb_0` with the hash noted in Task 1 Step 3 in all three places (the `echo`, `curl` and `tar` lines).
Run: `grep -c 'h6046fbb_0' .github/workflows/create-release.yml`
Expected: `0`.

- [ ] **Step 2: Fix the stale line reference in the upgrade doc**

In `dev-docs/upgrade-dependencies.md` line 3 replace
```markdown
Update hardcoded version strings in `src/command/check/check.ts` (`versionConstraints` array, ~line 249) so that they match the new versions in `configuration`. The `configuration` file warns about this in a comment.
```
with
```markdown
Update hardcoded version strings in `src/command/check/check.ts` (the `versionConstraints` array in `checkVersions`) so that they match the new versions in `configuration`. The `configuration` file warns about this in a comment, and `tests/smoke/check/check-versions-no-mismatch.test.ts` fails until they match.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/create-release.yml dev-docs/upgrade-dependencies.md
git commit -m "Point the RHEL Deno download at the 2.9.7 conda-forge build; refresh upgrade doc"
```
(If Step 1 was skipped, commit only the doc and drop the first half of the message.)

### Task 4: Local smoke run

**Files:** none

- [ ] **Step 1: Unit tests and the smoke directories that exercise runtime-sensitive code**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit -name '*.test.ts')
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  $(find smoke/render -name '*.test.ts') $(find smoke/site -name '*.test.ts') $(find smoke/website -name '*.test.ts') $(find smoke/project -name '*.test.ts') $(find smoke/run -name '*.test.ts') $(find smoke/inspect -name '*.test.ts') \
  $(find smoke/check -name '*.test.ts') $(find smoke/env -name '*.test.ts') $(find smoke/extensions -name '*.test.ts') $(find smoke/create -name '*.test.ts') $(find smoke/logging -name '*.test.ts')
```
Expected: all passed. A failure that also fails on `main` in the same environment is pre-existing (record it in the PR, do not fix it here); a failure only on this branch is a 2.9 regression: reproduce it with the single test file, read the Deno 2.8/2.9 release notes for the API involved, and fix the call site (or stop and report if the fix is not local).

- [ ] **Step 2: The `quarto run` path and the bundled build**

Run:
```bash
package/dist/bin/quarto run tests/docs/run/test-stdlib.ts; echo "exit=$?"
cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../pkg-working/bin && \
  (mv ../../../src/quarto.ts ../../../src/quarto1.ts; ./quarto --version; ./quarto check; mv ../../../src/quarto1.ts ../../../src/quarto.ts)
```
Expected: `exit=0` for the stdlib script (the user-script `DENO_DIR` cache still loads under 2.9); the bundle builds, `./quarto check` reports `Deno version 2.9.7: OK`; `src/quarto.ts` is restored (`git status --short src/quarto.ts` empty).

### Task 5: Changelog and status

**Files:**
- Modify: `news/changelog-1.11.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Open the PR as a draft to get its number**

Run: `git push -u origin rt/00a-deno-bump && gh pr create --draft --fill && gh pr view --json number -q .number`
Expected: the PR number, for example `15100`; it is used in the next step.

- [ ] **Step 2: Add the changelog section and entry**

In `news/changelog-1.11.md`, insert after the last entry of `## Regression fixes` (before `## Accessibility`):

```markdown
## Dependencies

- ([#15100](https://github.com/quarto-dev/quarto-cli/pull/15100)): Update `deno` to v2.9.7.
```
(with the PR number from Step 1 in both places). If another PR added a `## Dependencies` section in the meantime, add only the entry, in ascending number order.

- [ ] **Step 3: Set the PR 00a row to `in progress` and commit**

```bash
git add news/changelog-1.11.md dev-docs/runtime-migration/README.md
git commit -m "Changelog: Deno 2.9.7"
git push
```

### Task 6: Full suite and installers

**Files:** none

- [ ] **Step 1: Watch the PR checks**

The PR triggers `Parallel Smokes Tests` (the full suite in buckets on Linux and Windows), `Smoke Tests`, `Bundle Test`, `Test Tool Install`, `Runtime Boundary`.
Expected: all green. For a red bucket: open the failing test's log, rerun only that job once; a test that passes on rerun and fails on `main`'s latest scheduled run too is flaky (link the run in the PR); anything else is handled as in Task 4 Step 1.

- [ ] **Step 2: Dispatch the installer build without publishing**

Run: `gh workflow run create-release.yml --repo quarto-dev/quarto-cli --ref rt/00a-deno-bump -f publish-release=false`
Expected: in the resulting run, `make-installer-mac` (signing and notarization) and `make-installer-win` (signing) are green. Link the run in the PR description (required by `dev-docs/upgrade-dependencies.md` for every bundled-binary bump).

## Verification

- `package/dist/bin/quarto check versions` → no `does not strictly match`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts` → passed.
- Task 4 runs green; `quarto run tests/docs/run/test-stdlib.ts` exits 0.
- `quarto run --dev tools/check-runtime-boundary.ts` → `OK` with unchanged counts (this PR changes no counted file).
- CI and the installer dispatch as in Task 6.

## Review checklist

- [ ] `configuration` and `check.ts` name the same version, and it is the newest 2.9.x on the day of the PR.
- [ ] All five release assets were checked (Task 1 Step 2 output in the PR description).
- [ ] The conda-forge hash was updated in all three places, or the PR says why not.
- [ ] `configure` modified no other file (or only a format-only `deno_std.lock` rewrite, explained in the PR).
- [ ] The changelog entry is under `## Dependencies`, right after `## Regression fixes`.
- [ ] The installer dispatch run is linked and green.

## Risks and rollback

- A Deno 2.8/2.9 behaviour change breaks a code path the suite does not cover (for example `Deno.Command` stdio, `Deno.watchFs` during preview, KV). Shows up as user reports after a prerelease; the prerelease cycle before 1.11 stable is the buffer. Rollback: revert the commits (the launchers reconfigure automatically on the next run).
- A cached `@std` version stops resolving on the new Deno: `configure` fails loudly; fix per `dev-docs/upgrade-dependencies.md` in this PR.
- Conda builds of Quarto lag until conda-forge publishes `deno 2.9.7`; the feedstock usually follows within days. Not a blocker for the GitHub release.
- Rollback: `git revert` the commits; the version check and the launchers follow `configuration`.

## Decisions needed

None. Recorded: the target is the newest 2.9.x at execution (decision in `_TEMPLATE.md` pins "Deno `v2.9.x`, exact at execution"); later 2.9 patch bumps follow the same plan without a new migration PR.
