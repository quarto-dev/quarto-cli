---
main_commit: 2e6695811
analyzed_date: 2026-07-20
key_files:
  - tests/quarto-cmd.ts
  - tests/test.ts
  - tests/run-tests.sh
  - tests/run-tests.ps1
  - tests/integration/playwright-tests.test.ts
  - .github/workflows/test-smokes.yml
  - .github/workflows/test-smokes-built.yml
  - .github/workflows/test-ff-matrix.yml
  - .github/workflows/create-release.yml
  - .github/actions/build-dist-tarball/action.yml
---

# Built-Version Testing Architecture

How the smoke test suite runs against a **built** quarto distribution
(binary mode) in addition to the dev source tree, and — most importantly —
**why the design is the way it is**. This is the decision record; consult it
before changing the harness seam or the CI wiring, so settled trade-offs are
not accidentally relitigated.

Document map:

- **This doc** — architecture summary + design decisions (the durable "why").
- `tests/README.md` → "Binary mode" and "How tests run (diagrams)" — the
  operational "how" (local recipe, authoring rules, four mermaid diagrams).
- `llm-docs/testing-patterns.md` → "Dev Mode vs Binary Mode" — authoring
  patterns for tests that must work in both modes.

## Architecture in one paragraph

Every `testQuartoCmd()`-based test invokes quarto through a single dispatch
point, `runQuarto()` in `tests/quarto-cmd.ts`. In **dev mode** (default) it
calls the in-process `quarto()` entry point from `src/quarto.ts`, exactly as
the harness always has. In **binary mode** (`QUARTO_TEST_BIN` set to a built
quarto extracted *outside* the checkout) it spawns that binary as a
subprocess with `--log <file> --log-format json-stream`, merges the child's
log into the test's log file, and the verifiers run unchanged — they only
ever see log records and rendered outputs. CI-side, the reusable
`test-smokes.yml` gained `quarto-install: dev | release | artifact` inputs
(dev callers are untouched), and `test-smokes-built.yml` orchestrates three
sources for the binary under test: `build` (build from this ref, dispatch
only), `nightly` (reuse the signed artifacts of a nightly `create-release`
build — fires automatically via `workflow_run` after each one), and
`release` (install a published (pre-)release at its tag) — fanning each
source out to three test legs: smoke, playwright, and the feature-format
matrix (see "Built-mode test legs").

## When to use which mode

| Mode | Quarto under test | Trigger | Suites (legs) | Question answered |
|---|---|---|---|---|
| dev (`test-smokes.yml`) | in-process TS sources (99.9.9) | every PR/push + daily cron | everything (sharded per-commit; ff-matrix via its own cron/push/PR) | did this code change break behavior? |
| nightly | signed nightly artifacts (Linux tarball, signed `quarto.exe`, notarized Mac zip) | automatic, after each nightly build | smoke (linux+windows+mac) + playwright (linux+mac) + ff-matrix (linux+windows) | does what we *ship* work? (bundling/packaging/launcher bugs; only macOS smoke coverage in CI) |
| build | fresh linux-amd64 dist from the current ref (unsigned) | manual dispatch | smoke + playwright + ff-matrix (all linux) | will *this branch* survive packaging? (works on forks/PR branches) |
| release | published (pre-)release via quarto-actions/setup, harness at its `v` tag | manual dispatch | smoke (linux+windows) + playwright (linux) + ff-matrix (linux+windows) | is the version users download healthy? (curative, post-publish) |

Dev mode and built modes are complementary, not redundant: dev uniquely
covers `unit/`, `QUARTO_DEBUG` paths, the `quarto check` dev branch, and
in-process races; built modes cover the packaged product dev mode never
executes. The playwright suite (`integration/playwright-tests.test.ts`) is
no longer dev-only either: every built-mode source runs three suites
("legs") — smoke, playwright, and the feature-format matrix — see
"Built-mode test legs" below. The two other `tests/integration/` tests
(`guess-chunk-options-format-document.test.ts`,
`mermaid/github-issue-1340.test.ts`) still run only in the dev shards.

In practice:

- **Mostly, trigger nothing.** `nightly` fires itself after each nightly
  build and is the preventive workhorse: it tests the exact signed
  binaries the release pipeline produces, on all three OSes, *before*
  anything is published. Red here means we caught it before users did.
- **Dispatch `build`** when a branch touches packaging or the harness
  itself (`prepare-dist`, `configure`, `tests/quarto-cmd.ts`, ...) and you
  want built-version feedback on *that ref* now. Trades coverage
  (linux-only, unsigned) for immediacy and fork-friendliness. To get
  *signed* Windows binaries for a branch instead, dispatch
  `create-release` with `publish-release=false` +
  `smoke-artifacts-only=true` — the `workflow_run` trigger then tests the
  build automatically (only the legs whose artifacts exist); a manual
  `source=nightly` dispatch with a `run-id` is just for re-testing an
  older run (see D7).
- **Dispatch `release`** after publishing, as post-publish verification —
  e.g. the optional step in
  `dev-docs/checklist-make-a-new-quarto-prerelease.md`. Curative by
  nature: it can only detect a broken published version, never prevent
  one. Only works for releases cut after the harness support merged (D10).

## Built-mode test legs (scheduler layout)

`test-smokes-built.yml` = the mode **resolvers** (build-artifact /
resolve-nightly / resolve-release, unchanged) + a **scheduler**: per-leg
caller jobs fanning out to the reusable workflows. Three legs per source
mode, each an independent job (one red suite never cancels the others):

| leg | goes through | bucket | OS scope |
|---|---|---|---|
| smoke | `test-smokes.yml` | `inputs.buckets` (empty = binary-mode `smoke/` default) | build: linux; nightly: linux+windows+mac (`has-*` gated); release: linux+windows |
| playwright | `test-smokes.yml` | `["integration/playwright-tests.test.ts"]` | linux (+ mac on nightly) — **never windows**, see below |
| ff-matrix | `test-ff-matrix.yml` (reusable) | owned by `test-ff-matrix.yml` | linux (+ windows on nightly/release) — no macOS (Julia/TeX toolchain unproven there) |

Key points:

- **The smoke leg doubles as the general bucket runner.** A manual dispatch
  with the `buckets` input set runs only the smoke-slot jobs with that
  bucket; the playwright + ff-matrix legs carry
  `github.event.inputs.buckets == ''` in their `if:` and skip.
- **No windows playwright leg, deliberately.** The browser assertions are
  hard-ignored on Windows CI (`playwright-tests.test.ts`
  `ignore: gha.isGitHubActions() && isWindows`) — a windows leg would render
  the corpus, skip every assertion, and report a misleading green. Rework
  that gate (plus the `runner.os != 'Windows'` report-upload gate in
  `test-smokes.yml`) before adding windows to the leg.
- **The playwright render wrapper needs the sanitized spawn env.**
  `playwright-tests.test.ts` renders via `execProcess` +
  `quartoDevCmd()` and MUST pass `quartoSpawnEnvOptions()`: without it the
  built quarto inherits the dev-tree env (`QUARTO_SHARE_PATH`, ...) exported
  by `run-tests.[sh|ps1]` for the harness and silently renders with
  dev-tree resources (the D3/D4 dev-mode trap).
- **Playwright report artifacts are named per OS**
  (`playwright-report-${{ runner.os }}`): several `test-smokes.yml` calls
  share one workflow run in the fan-out, and duplicate artifact names make
  `upload-artifact` fail even on green tests.
- **Per-leg OS scope is tuned in one place** — the `runners` inputs on the
  scheduler jobs in `test-smokes-built.yml`.

### `test-ff-matrix.yml` is reusable (`workflow_call`)

The ff-matrix bucket glob
(`../dev-docs/feature-format-matrix/qmd-files/**/*.qmd`) is defined **only**
in `test-ff-matrix.yml`; built-mode callers reuse it through its
`workflow_call` trigger, which coexists with the dev triggers
(cron/push/PR/dispatch). Inputs `quarto-install`, `quarto-version`,
`quarto-artifact-name`, `quarto-artifact-run-id`, `ref`, `runners`,
`extra-r-packages` are forwarded verbatim to `test-smokes.yml`; the job uses
`${{ inputs.x || <dev default> }}` fallbacks so the non-call triggers (where
`inputs.*` is empty) keep today's dev behavior. Nesting depth
`test-smokes-built.yml → test-ff-matrix.yml → test-smokes.yml` is 3, well
within GitHub's reusable-workflow nesting limit. CAUTION on
`test-ff-matrix.yml`'s top-level `concurrency`: a called workflow's
top-level concurrency evaluates in the CALLER's context
(`github.workflow`/`ref`/`run_id` are the caller run's), so the group
carries a per-call suffix derived from `inputs.runners` + `github.run_id` —
without it, every ff-matrix leg of one `test-smokes-built.yml` run would
share a single cancel-in-progress group and could cancel a sibling leg.
Dev triggers get a constant `-dev` suffix (dedup semantics unchanged).
`test-ff-matrix.yml` declares no `permissions`, so the caller's
`actions: write` (julia cache cleanup) flows through.

## Design decisions

Each entry: what was decided, why, and what would justify revisiting.

### D1. Nightly wiring: `workflow_run`, not `workflow_call`/dispatch/inversion

**Decision.** `test-smokes-built.yml` listens for completed "Build
Installers" (`create-release.yml`) runs via `workflow_run` and reuses their
artifacts cross-run (`quarto-artifact-run-id`). The release pipeline is not
modified for testing purposes.

**Alternatives considered (2026-07, maintainer question):**

- *create-release dispatches the test workflow at the end* — `workflow_run`
  hand-rolled: needs `actions: write` + `gh workflow run` code inside the
  release workflow, same default-branch constraint. Strictly dominated.
- *create-release `workflow_call`s `test-smokes.yml` after building* —
  same-run artifacts (no run-id resolution) and an explicit DAG, but smoke
  results would redden `Build Installers` runs including real publishes;
  gating to schedule-only moves testing configuration (buckets, runner
  policy) into the release workflow permanently.
- *Inversion: `test-smokes-built` owns the daily schedule and calls
  `create-release` via `workflow_call`* — feasible (create-release uses the
  `inputs.` context exclusively, which works under `workflow_call`; its
  `github.event_name == 'schedule'` guard still behaves because a called
  workflow sees the caller's event). Rejected because: (a)
  `smoke-artifacts-only` skips `make-installer-mac`, so the daily run would
  need the full build anyway — zero compute saved (there is no double
  build today: one nightly build, one test pass reusing its artifacts);
  (b) it reverses the dependency — the nightly build is also a
  release-pipeline canary (signing certs, notarization, installer tooling)
  and must not die when the test workflow is broken or paused; (c) nightly
  builds would disappear from the "Build Installers" run history.

**Why `workflow_run` wins:** zero risk to the most sensitive workflow in
the repo, and clean failure attribution — "Build Installers" red = the
pipeline broke; "Smoke Tests (Built Version)" red = the product broke.

**Known weaknesses (accepted):** the trigger couples on the workflow
*display name* string (`workflows: ["Build Installers"]`; renaming
create-release's `name:` silently stops the trigger), and "trigger never
fired" is silent (mitigated by daily cadence — an absent run is visible).
Note the trigger fires on EVERY completed create-release run, not only
nightly schedules — manual dispatches (including partial
`smoke-artifacts-only` builds) get tested too, which is why each nightly
OS leg is gated on its artifact actually existing in the resolved run.

**Revisit when:** the system has a green track record and maintainers want
one atomic nightly build-and-test signal — then the inversion is the
principled consolidation, done as a deliberate follow-up.

### D2. Version marker: semver *build metadata* (`X.Y.Z+test.YYYYMMDD`)

Built test dists are stamped `$(cat version.txt)+test.$(date +%Y%m%d)`.
Never a `-suffix` (prerelease versions fail every plain `>=X.Y`
`quarto-required` range — the vendored semver has no `includePrerelease`
anywhere) and never a 4th dot component (not semver; the vendored
`deno.land/x/semver@1.4.0` throws). Build metadata is range-transparent for
every gate while still distinguishable from the `99.9.9` dev sentinel.

### D3. Dist outside the checkout + `99.9.9` sentinel refusal

Installed launchers detect dev mode via a sibling `src/quarto.ts`: an
in-repo `package/dist/bin/quarto` silently runs the TS sources instead of
the built code. Therefore the dist under test must be extracted *outside*
the repo, and both `run-tests.[sh|ps1]` and `assertTestBinary()` refuse a
binary reporting `99.9.9` (`kLocalDevelopment`). CI extracts artifacts to
`RUNNER_TEMP`.

### D4. Child env: inherit ambient + strip dev vars (not clearEnv+allowlist)

Binary-mode spawns inherit the ambient environment minus a strip list
(`QUARTO_SHARE_PATH`, `QUARTO_BIN_PATH`, `DENO_DIR`, `QUARTO_DEBUG`,
`QUARTO_FORCE_VERSION`, ...), with `TestContext.env` overlaid last. A
clearEnv+allowlist was rejected: the Windows system-variable surface
(`SystemRoot`, `PATHEXT`, ...) is unenumerable in practice. The dev-tree
exports in `run-tests.[sh|ps1]` are kept in all modes — the *harness*
process still needs them; only the *child* is sanitized.

### D5. Silent-green guard: synthetic ERROR records

"Non-zero exit ⇒ ERROR record in the log" is NOT an invariant
(pre-logger-init failures, `quarto add/remove` commandFailed, pandoc/typst
passthroughs), and ~23% of smoke-all docs are verified only via the log. So
`runQuarto()` appends a synthetic `{level: 40}` record (exit code + stderr
tail) when a non-zero exit leaves the child log record-free, and a timeout
record when the process-tree kill fires (`pgrep -P` walk on POSIX —
portable to macOS, unlike `ps --ppid`; `taskkill /T` on Windows).

### D6. `QUARTO_TEST_BIN` is set at runtime, never declared statically

The "Pin and verify test target" step in `test-smokes.yml` resolves the
installed binary, verifies it (sentinel refusal, semver shape, optional
`QUARTO_TEST_EXPECTED_VERSION` match), and exports it via `$GITHUB_ENV` so
every later step — including the unchanged `run-tests.sh` invocation —
sees it. With `quarto-install: dev` (all pre-existing callers) these steps
are skipped and nothing changes.

### D7. `smoke-artifacts-only` is for cheap *branch* builds, not the daily path

The `create-release.yml` input skips source/arm64 tarballs and the Mac
installer, yielding a fast signed Linux+Windows build for on-demand testing
of a branch: dispatch create-release with `publish-release=false` +
`smoke-artifacts-only=true` and the `workflow_run` trigger tests the build
automatically (mac leg skipped via the artifact-existence gate — one
dispatch total). Guards: `configure` fails fast if `publish-release` (which
defaults to true) is combined with `smoke-artifacts-only` — otherwise the
version commit+tag step would push an orphan tag — and such runs use a
per-run concurrency group so they never queue in the shared `prerelease`
group against a real release. It deliberately does NOT feed the daily
path: the daily needs the full build (Mac Zip = the only macOS smoke
coverage).

### D8. macOS runners: scheduled/built runs only, never per-commit

`test-smokes-parallel.yml` (per-commit) must stay fast, so it never passes
`runners` and keeps the `ubuntu-latest`/`windows-latest` default. The only
`macos-latest` smoke job is the nightly Mac leg in `test-smokes-built.yml`.
Encoded in the `runners` input description in `test-smokes.yml`.

### D9. Built mode runs smoke + playwright + ff-matrix daily; the dev crons stay

**Revised 2026-07-20** (originally: `integration/` stays dev-only with a
future dev daily job — that deferral is resolved the other way).

Built mode is not smoke-only: the nightly path (and every other source
mode) runs three legs — smoke, playwright
(`integration/playwright-tests.test.ts`), and the feature-format matrix —
so packaging/launcher/signing regressions surface in browser behavior and
the full ff corpus too, not just the smoke suite (see "Built-mode test
legs"). Both suites were only ever excluded from binary mode by the
`run-tests.[sh|ps1]` default, never hard-blocked; the harness prerequisites
(the `quartoSpawnEnvOptions()` render-env fix, playwright provisioning in
non-dev CI modes) are in place.

What stays dev-only: `unit/` (in-process by definition), the
non-playwright `integration/` tests
(`guess-chunk-options-format-document.test.ts`,
`mermaid/github-issue-1340.test.ts` — dev shards only), `QUARTO_DEBUG`
paths, the `quarto check` dev branch, and in-process races. Also
*temporarily* dev-only: the julia-engine subtree tests
(`smoke/julia-engine/`, copied in by `merge-extension-tests`) — their raw
`Deno.Command("quarto")` spawns inherit the harness dev env (the D3/D4
trap: `QUARTO_DEBUG` crashes the built quarto in `checkReconfiguration`),
so the merge action skips them when `QUARTO_TEST_BIN` is set until the
spawns are sanitized upstream; plan in
`dev-docs/ci-julia-engine-binary-mode-followup.md`. Residual gaps
no suite exercises against the built quarto (not covered anywhere in CI
today, recorded so they read as known boundaries rather than oversights):
`quarto preview`/serve interactive paths (the playwright render glob
excludes `docs/playwright/(serve|shiny)`), `quarto publish` flows
(credentials), the actual installer packages (`.deb`/`.msi`/`.pkg` — the
legs test the tarball/zip layouts, never install-time behavior like PATH or
registry), the linux-arm64 tarball, and playwright visual snapshots
(`--ignore-snapshots`). Windows browser behavior and macOS ff-matrix are
also uncovered but deliberate, with revisit conditions in "Built-mode test
legs". The daily dev
crons also stay — dev ff-matrix catches source regressions, built
ff-matrix catches packaging regressions; complementary, not redundant.
Nothing is throttled initially (all legs daily): per-leg OS scope lives in
the scheduler jobs as the tuning knob once real CI spend is observed. Known
cost blind spot, accepted: the `workflow_run` trigger fires on EVERY
completed create-release run (D1), so manual builds also get the full
fan-out; gate the heavy legs on
`github.event.workflow_run.event == 'schedule'` if that ever needs
trimming.

### D10. Release mode only works for post-harness tags

Release mode checks out the tag, so the harness at that tag must already
contain `tests/quarto-cmd.ts` — a preflight fails clearly for older
releases. True backfill (main-branch harness testing an older binary)
would require harness/binary decoupling (plan §6 Phase 4, not implemented).

The same skew applies per-suite: nightly/release legs run the harness at
the *target* ref, so a ref that has `tests/quarto-cmd.ts` but predates the
`quartoSpawnEnvOptions()` render fix in `playwright-tests.test.ts`
(2026-07-20) runs the old env-leaking wrapper — its playwright leg renders
with dev-tree resources and its result (green or red) is not meaningful.
The existence preflight cannot detect this. Affected window: releases and
nightly build shas cut between the harness-support merge and the multi-leg
merge, including the first post-merge `workflow_run` firings on pre-merge
build commits. The smoke and ff-matrix legs are unaffected (their spawns go
through `runQuarto`, whose env sanitization is as old as `quarto-cmd.ts`).
