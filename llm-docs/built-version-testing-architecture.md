---
main_commit: a3f6218b7
analyzed_date: 2026-07-17
key_files:
  - tests/quarto-cmd.ts
  - tests/test.ts
  - tests/run-tests.sh
  - tests/run-tests.ps1
  - .github/workflows/test-smokes.yml
  - .github/workflows/test-smokes-built.yml
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
`release` (install a published (pre-)release at its tag).

## When to use which mode

| Mode | Quarto under test | Trigger | Question answered |
|---|---|---|---|
| dev (`test-smokes.yml`) | in-process TS sources (99.9.9) | every PR/push + daily cron | did this code change break behavior? |
| nightly | signed nightly artifacts (Linux tarball, signed `quarto.exe`, notarized Mac zip) | automatic, after each nightly build | does what we *ship* work? (bundling/packaging/launcher bugs; only macOS smoke coverage in CI) |
| build | fresh linux-amd64 dist from the current ref (unsigned) | manual dispatch | will *this branch* survive packaging? (works on forks/PR branches) |
| release | published (pre-)release via quarto-actions/setup, harness at its `v` tag | manual dispatch | is the version users download healthy? (curative, post-publish) |

Dev mode and built modes are complementary, not redundant: dev covers
`unit/`, `integration/`, `QUARTO_DEBUG` paths, and the `quarto check` dev
branch; built modes cover the packaged product dev mode never executes.

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

### D9. The daily dev cron stays (for now)

Built-version nightly runs do not replace the daily dev `test-smokes.yml`
schedule: dev mode uniquely covers `QUARTO_DEBUG` paths, the `quarto check`
dev branch, in-process races, and doc-only PRs. Pending maintainer decision
after ~2 weeks of green nightly runs (plan §6 Phase 5): add a cheap daily
dev job for `unit/` + `integration/`, then downgrade the daily dev cron to
weekly — never delete it.

### D10. Release mode only works for post-harness tags

Release mode checks out the tag, so the harness at that tag must already
contain `tests/quarto-cmd.ts` — a preflight fails clearly for older
releases. True backfill (main-branch harness testing an older binary)
would require harness/binary decoupling (plan §6 Phase 4, not implemented).
