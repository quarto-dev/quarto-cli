# Plan: Running Smoke Tests Against a Built Quarto

Status: **detailed design — v2** (grounded; pending adversarial review + Phase 0 spike).

Goal: run the existing smoke test suites — the full smoke-all corpus first,
plus the `.test.ts` smokes and the feature-format matrix — against a
**built** Quarto (an artifact produced in the same CI run, or a published
GitHub (pre)release), instead of only the dev source tree.

Decisions (maintainer, 2026-07-17):

- Weekly `schedule` **plus** manual `workflow_dispatch`.
- Scope: **full smoke-all** (ff-matrix bucket optional extra).
- Primary mode is **preventive build-then-test**: build the artifact in the
  same workflow run and test it — not only after-the-fact testing of
  published prereleases (that stays as a secondary dispatch input).
- No release-pipeline gating until the mode has a track record.

---

## 1. How testing works today (established facts)

- `testQuartoCmd` invokes Quarto **in-process**: it imports `quarto()` from
  `src/quarto.ts` (`tests/test.ts:13`) and calls it directly
  (`tests/test.ts:159-162`). There is no subprocess and no configurable seam.
- Before each test the harness redirects Quarto's logger to a temp file in
  `json-stream` format (`tests/test.ts:243-249`); after execution it parses
  the file into `ExecuteOutput { msg, level, levelName }` records
  (`test.ts:176-180, 386-392`) consumed by every log verifier
  (`noErrors`, `noErrorsOrWarnings`, `shouldError`, `printsMessage` —
  `tests/verify.ts:107-205`). Errors thrown by `execute()` are caught and
  converted into ERROR log records before verification (`test.ts:262-266`).
- All file-content verifiers read produced output files off disk.
- `tests/run-tests.sh` runs the harness under the repo-bundled Deno with
  `--importmap=src/import_map.json` and exports dev paths:
  `QUARTO_BIN_PATH=package/dist/bin` (`:47`),
  `QUARTO_SHARE_PATH=src/resources` (`:60`), `QUARTO_DEBUG=true` (`:61`),
  `DENO_DIR=package/dist/bin/deno_cache` (`:50-54`).
- `smoke-all.test.ts` globs `docs/smoke-all/**/*.{md,qmd,ipynb}`, parses
  `_quarto.tests` with dev-source YAML code, dispatches spec keys to
  verifiers via an inline `verifyMap`, and renders via
  `testQuartoCmd("render", [input, "--to", format])` (`:462`); project
  pre-renders call `quarto(["render", projectPath])` directly (`:434`).
- The **feature-format matrix is a smoke-all bucket**:
  `test-ff-matrix.yml:44-50` calls `test-smokes.yml` with a qmd glob that
  `run-tests.sh:132-164` routes to `smoke-all.test.ts`. Anything that fixes
  smoke-all fixes the matrix.
- `create-release.yml` runs nightly: builds per-OS artifacts, uploads them
  as workflow artifacts, publishes GitHub Release assets (prerelease by
  default) and tags `v<version>` on the exact commit built
  (`create-release.yml:88-100,678-703`). The linux tarball recipe is just
  `./configure.sh` → `quarto-bld prepare-dist --set-version <v>` → tar of
  `package/pkg-working` (`create-release.yml:136-159`).

## 2. Strategy

1. **The dev-tree coupling is concentrated in one seam** — the body of
   `test.execute()` (in-process `quarto()` call + programmatic logger init).
   The verifier layer and the `_quarto.tests` dispatch consume only the
   json-stream log file and files on disk, both reproducible by a
   subprocess via `--log <file> --log-format json-stream --log-level info`.
2. **Version skew is avoided by construction.** The primary workflow builds
   the artifact from the same SHA the harness checks out. For
   published-release testing, check out `refs/tags/v<version>`. The harness
   keeps importing `src/` for *parsing and path math* only; *execution*
   moves to the binary.

## 3. Ground truths verified in code (2026-07-17)

These were verified by dedicated review passes with file:line evidence;
the design in §4–§5 depends on them.

**Log pipeline (CONFIRMED):**

- `--log`, `--log-level`, `--log-format` are global options appended to
  every command (`src/core/log.ts:49-95`; applied via the `cmdHandler` in
  `src/quarto.ts:231-234`), and — decisive — the logger is initialized in
  `mainRunner` from a **raw-args parse before any command runs**
  (`src/core/main.ts:23-27`, `logOptions` at `src/core/log.ts:97-118`). Env
  fallbacks `QUARTO_LOG`, `QUARTO_LOG_LEVEL`, `QUARTO_LOG_FORMAT` exist but
  explicit flags win. No command bypasses logger init.
- json-stream writes one `JSON.stringify(logRecord)` per line with
  `msg`/`level`/`levelName` (`log.ts:262-263`) — byte-compatible with
  `readExecuteOutput`. The file handler **flushes after every record**
  (`log.ts:267-273`), so even a hard crash loses nothing already logged.
- On render failure an ERROR record is written before exit 1: errors
  propagate to `mainRunner`'s catch → `logError(e)` (`main.ts:70-73`) →
  ERROR record in the file; then `exitWithCleanup(1)` (`main.ts:74-81`).
  `CommandError` likewise (`src/quarto.ts:202-208`).
- **Exception:** the `pandoc`/`typst`/`run` passthroughs `Deno.exit(code)`
  with the child's code and route child stderr directly — a failing
  passthrough writes no ERROR record to the log file (`src/quarto.ts:100,
  119, 139`). The tests covering these already use `execProcess` and assert
  on stdout/stderr/exit code, so this is a documentation caveat for the
  seam, not a blocker.

**`QUARTO_FORCE_VERSION=99.9.9` is rejected (NUANCED → do not use):**
honored at `src/core/quarto.ts:34-45` but `99.9.9` equals
`kLocalDevelopment`, which (a) satisfies every lower-bound version gate
(extensions `src/extension/extension.ts:776-788`, document
`quarto-required` `src/command/render/render-files.ts:130-144`, engines
`src/execute/engine.ts:62-80`, freezer `src/core/cache/cache.ts:81`) —
masking real "version too old" behavior — and (b) flips `quarto check`
into a dev-mode branch that shells `git rev-parse` in `$QUARTO_ROOT`
(`src/command/check/check.ts:288-302`). The binary must report its real
version; the fixtures get fixed instead (§4.6).

**The `>=99.9.0` fixtures are scaffolding artifacts (git archaeology):**
`quarto create extension` computes `quarto-required` from the *running*
version truncated to `major.minor.0`
(`src/command/create/artifacts/artifact-shared.ts:143`); on a dev build
(`99.9.9`) that yields exactly `>=99.9.0`. All ten fixtures were authored
on dev checkouts (four separate lipsum vendorings 2023; brand/typst
fixtures 2025–2026). No test anywhere exercises the version-gate error
path (zero test references to `quarto-required` / "incompatible with this
quarto"); sibling extensions in the same `_extensions/` dirs use
`>=1.3.0`, as does upstream `quarto-ext/lipsum` and Quarto's own bundled
copy (`src/resources/extensions/quarto/lipsum/_extension.yml:4`). **All
ten are safe to relax.**

**Launcher & env behavior:**

- The installed launcher inherits `QUARTO_SHARE_PATH` and `QUARTO_DEBUG`
  if already set (`package/scripts/common/quarto:102-110, 68-70`;
  `package/scripts/windows/quarto.cmd:80-81, 47`), recomputes
  `QUARTO_ROOT`/`QUARTO_BIN_PATH` unconditionally, and **never sets
  `DENO_DIR` outside dev mode** — so a leaked dev `DENO_DIR` reaches the
  binary's deno. Strip list follows in §4.2.
- **Dev-mode trap:** the launcher decides dev vs installed by finding a
  sibling `src/quarto.ts` relative to its own path
  (`common/quarto:22-37`). Therefore `QUARTO_TEST_BIN` pointing at the
  in-repo `package/dist/bin/quarto` silently runs **dev mode** (TS
  sources, `--check`, dev env defaults) — not the built layout. The dist
  must be extracted **outside the git checkout**, and the seam must fail
  loudly if `<bin> --version` reports `99.9.9`.
- A genuinely installed binary runs a single esbuild-bundled `quarto.js`
  with `--no-check` (`common/quarto:91-121, 205-208`), a real
  `share/version` file, inlined Lua filters, and arch-specific
  deno/deno_dom (`package/src/common/prepare-dist.ts:128-147, 191-224`).
  Binary mode therefore covers bundling/import-resolution errors, missing
  share resources, version wiring, and the `--no-check` gap — none of
  which dev mode can catch.
- `QUARTO_DEBUG=true` (dev default) only adds stack traces to ERROR `msg`
  text (`src/core/log.ts:371-386`) plus dev-only reconfigure/watch paths.
  Binary mode runs **without** it — truer to shipped behavior; ERROR
  counts are unaffected, only `printsMessage` regexes matching stack text
  could differ (none known in smoke-all: audit found all `printsMessage`
  levels are INFO/WARN/ERROR with content-based regexes).
- **Windows built layout ships two entry points.** `prepare-dist` copies
  `quarto.cmd` into the dist (`copyQuartoScript`,
  `package/src/common/configure.ts:143-149`); the `make-installer-win`
  job additionally builds and signs the **Rust launcher `quarto.exe`**
  (`cargo build`, `package/launcher/src/main.rs`;
  `create-release.yml:350-429`), which is what the MSI/zip put on PATH —
  i.e. what Windows users actually run. `QUARTO_TEST_BIN` should target
  `quarto.exe` for published-release testing (trivial spawn, no `.cmd`
  handling); a `prepare-dist`-only Windows artifact has `quarto.cmd`,
  which spawns **directly** with `Deno.Command` — no `cmd /c` (the repo's
  established pattern: `quartoDevCmd()` `tests/utils.ts:244-246`; npm.cmd
  in `src/project/serve/serve.ts:434`). Notes: the Rust launcher has **no
  dev-mode branch** (always runs the bundled `quarto.js` — the dev-mode
  trap below doesn't apply to it), reads `--version` straight from
  `share/version`, and inherits `QUARTO_SHARE_PATH` and `QUARTO_DENO`
  from the environment (`path_from_env`, `main.rs:21-23,50-52`) — the
  strip list applies to it equally.

**CI structure:**

- `run-tests.sh` **never** uses PATH `quarto`; it hardcodes the harness
  runtime at `package/dist/bin/tools/<arch>/deno` +
  `package/dist/bin/deno_cache` + `src/import_map.json`
  (`run-tests.sh:47,57,164`), all produced only by `configure.sh`.
  **Consequence: the `quarto-dev` action must run in every CI mode** —
  it provisions the harness runtime; the built binary is added *on top*
  (PATH override + `QUARTO_TEST_BIN`), not substituted. (Corrects v1 §4.0,
  which framed the setup modes as mutually exclusive.)
- The dev symlink lands in `/usr/local/bin`
  (`package/src/common/dependencies.ts:87-127`); a later `$GITHUB_PATH`
  prepend shadows it for all subsequent steps, so
  `quarto install tinytex/verapdf/chrome-headless-shell`
  (`test-smokes.yml:236,243,251`) and PATH-based tests automatically use
  the binary under test. `merge-extension-tests` is a plain `cp -r` — mode
  independent.
- `prepare-dist` writes only to `package/pkg-working` (disjoint from
  `package/dist`; `package/src/common/config.ts:65-89`) and removes only
  `package/dist/config` (unused by `run-tests.sh`), so build and test can
  share a checkout; separate jobs remain preferable for artifact reuse and
  a future OS matrix. `configure.sh` + `prepare-dist` need network (public
  URLs) but **no secrets** and no signing for the linux tarball.

## 4. Design — harness "binary mode"

Activated by `QUARTO_TEST_BIN=<abs path to installed quarto | quarto.exe |
quarto.cmd>` (on Windows prefer `quarto.exe` — what releases ship, §3).
Unset ⇒ current behavior, byte-for-byte unchanged.

### 4.1 The execution seam (`tests/test.ts` + a shared helper)

New helper (e.g. `tests/quarto-cmd.ts`):

```ts
export function binaryMode(): string | undefined =>
  Deno.env.get("QUARTO_TEST_BIN") || undefined;

// Single dispatch point used by test.execute() AND all direct call sites.
export async function runQuarto(
  args: string[],
  options?: { env?: Record<string, string>; cwd?: string;
              logFile?: string; timeoutMs?: number },
): Promise<void>
```

- **Dev branch** (no `QUARTO_TEST_BIN`): call in-process `quarto(args,
  undefined, options?.env)` exactly as today.
- **Binary branch**: `new Deno.Command(bin, { args: [...args, "--log",
  logFile, "--log-format", "json-stream", "--log-level", "info"], cwd,
  env: <contract §4.2>, clearEnv: true })`.
  - Reuse the temp log path already created at `test.ts:243`; in binary
    mode skip `initializeLogger` for capture but keep the harness able to
    append its own ERROR records (spawn failure, timeout) to the same file
    so existing reporting works.
  - **Do not throw on non-zero exit** — the binary already wrote its ERROR
    record (§3); mirrors today's catch-and-log at `test.ts:262-266`.
  - Timeout: `setTimeout` → `child.kill("SIGKILL" /* windows: kill() */)`,
    then append a timeout ERROR record. (Improvement over dev mode, where
    a timed-out render keeps running.)
  - `--log*` flags are appended **only** here — never for tests that spawn
    quarto themselves and own their flags
    (`logging/log-level-and-formats.test.ts` tests exactly those flags).
- `testQuartoCmd`'s `cwd` context keeps chdir-ing the harness process
  (relative-path verifiers and teardowns depend on it) *and* passes cwd to
  the subprocess.
- Startup guard, once per run: if `QUARTO_TEST_BIN` is set, execute
  `<bin> --version`; **fail hard** if it reports `99.9.9` (dev-mode trap,
  §3) or doesn't match `QUARTO_TEST_EXPECTED_VERSION` when provided.
  Print the version banner.

### 4.2 Env contract for the spawned binary

With `clearEnv: true`, construct the child env as:

1. **Base pass-through from ambient env** (needed for engines/toolchains):
   `PATH`, `HOME`/`USERPROFILE`, `TMPDIR`/`TEMP`/`TMP`, `LANG`/`LC_*`,
   `VIRTUAL_ENV`, `PYTHONPATH`, `R_LIBS*`, `RENV_*`, `JULIA_*`,
   `GH_TOKEN`, CI markers (`CI`, `GITHUB_ACTIONS`), proxy vars, and the
   toolchain overrides `QUARTO_R`, `QUARTO_PYTHON`, `QUARTO_TYPST`,
   `QUARTO_ESBUILD`, `QUARTO_DART_SASS`, `QUARTO_CHROMIUM`,
   `QUARTO_TEXLIVE_BINPATH`, `QUARTO_TINYTEX_REPOSITORY`,
   `QUARTO_KNITR_RSCRIPT_ARGS` (audit: legitimately CI-environment vars,
   not dev-tree vars — stripping them breaks every engine test).
2. **Never pass** (dev-tree identity; the strip list):
   `QUARTO_SHARE_PATH`, `QUARTO_BIN_PATH`, `QUARTO_DEBUG`, `DENO_DIR`,
   `QUARTO_DENO`, `DENO_DOM_PLUGIN` (both launchers inherit these if
   set — bash `common/quarto:167-179`, Rust `main.rs:50-60`),
   `QUARTO_ROOT`, `QUARTO_SRC_PATH`, `QUARTO_FORCE_VERSION`,
   `QUARTO_VERSION_REQUIREMENT`, `QUARTO_PROJECT_DIR` (stale-leak guard),
   `RSTUDIO` (must be affirmatively absent for the "not RStudio" test).
3. **Overlay `context.env` last** (per-test intent wins): e.g.
   `QUARTO_PROFILE`, `QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES/_OUTPUT_FILES`,
   `QUARTO_PDF_STANDARD`, `QUARTO_LOG_LEVEL`, `RSTUDIO=1`, `LUA_PATH`.

The exact allowlist is finalized in Phase 0 when real failures show what's
missing; the shape (allowlist + strip + overlay) is fixed.

### 4.3 smoke-all driver changes (`tests/smoke/smoke-all.test.ts`)

- Route the project pre-render (`:434`) and the `editor-support-crossref`
  pseudo-format (2 docs) through `runQuarto`.
- Everything else (discovery, `_quarto.tests` parsing, `verifyMap`
  dispatch, cleanup, `run:` skip logic) is harness-side and unchanged.
- The YAML-intelligence bootstrap stays (harness-process-only).

### 4.4 Runner plumbing (`run-tests.sh` / `run-tests.ps1`)

When `QUARTO_TEST_BIN` is set (or `--bin <path>` given):

- Still resolve the repo Deno + import map — the harness always needs them.
- **Do not export** `QUARTO_SHARE_PATH` / `QUARTO_DEBUG` (defense in depth
  on top of `clearEnv`; also keeps the harness's own process honest).
- Default no-args test selection must **exclude `unit/`** (dev-only by
  definition) — e.g. pass the `smoke/` tree explicitly instead of letting
  `deno test` discover everything.
- Print `<bin> --version` banner; refuse `99.9.9` (§4.1 guard).

### 4.5 Test adaptations (from the 133-file classification, §8)

- **Shared-helper migrations** (~14 files importing `src/quarto.ts`):
  replace direct `quarto()` calls with `runQuarto` (setup pre-renders:
  `render-freeze`, `render-format-extension`,
  `render-output-file-collision`, `extension-render-{journals,
  typst-templates}`; bodies: `crossref/syntax`, `convert/issue-12318`,
  `jupyter/cache`, `self-contained/stdout`, `issues/9133`). Trivial
  `testQuartoCmd` rewrites where possible (`jupyter/issue-10097`,
  `issue-12374`). `engine/invalid-engine-in-project` converts from
  `assertRejects` (currently un-awaited — a latent bug) to exit-code +
  ERROR-log assertion.
- **`quartoDevCmd()` one-liner** (`tests/utils.ts:244`): return
  `QUARTO_TEST_BIN` when set — migrates `run/*`, `lua-unit`, `logging`,
  `create` wholesale; consolidate the hardcoded
  `../package/dist/bin/quarto` spawns (`filters/editor-support`,
  `typst-gather`) onto it.
- **Semantic one-offs**: `env/check.test.ts` — compute expected version
  from the binary instead of hardcoding `99.9.9`;
  `inspect-standalone-rstudio` — `RSTUDIO=1` via `context.env` in binary
  mode (the in-process `_setIsRStudioForTest` hook stays for dev mode).
- **Anti-pattern fix**: `website/drafts-env.test.ts` converts
  `Deno.env.set("QUARTO_PROFILE", ...)` to `context.env` (already flagged
  by `.claude/rules/testing/test-anti-patterns.md`; would become
  cross-subprocess leakage in binary mode).
- **Move, don't flag**: the 2 genuinely dev-only files
  (`yaml-intelligence/yaml-intelligence.test.ts`,
  `yaml-intelligence-folded-block-strings.test.ts`) move to `tests/unit/`.
  `TestContext.requiresDevQuarto` is still added as an escape hatch
  (sets Deno `ignore` in binary mode) but starts with zero users.
- **Guard rails** (lightweight lint/CI checks): forbid
  `import ... from ".*src/quarto.ts"` under `tests/smoke/`; forbid
  quarto spawns not routed through `quartoDevCmd()`/`runQuarto`.

### 4.6 Fixture fixes

- Relax the ten `quarto-required: '>=99.9.0'` fixture extensions to
  `'>=1.9'` (evidence in §3; matches their own sibling extensions).
- These are safe, standalone commits that can land **before** any harness
  work (they are no-ops for dev mode since `99.9.9 >= 1.9`).

## 5. CI design

### 5.1 Parameterize `test-smokes.yml`

New `workflow_call` inputs: `quarto-install` (`dev`|`release`|`artifact`,
default `dev`), `quarto-version` (for `release`), `quarto-artifact-name`
(for `artifact`), and `ref` (checkout ref, so callers can pin harness =
binary commit).

Step changes — all **additive**, inserted after the existing `quarto-dev`
step (`test-smokes.yml:230`), which now runs **unconditionally in every
mode** (it provisions the harness Deno runtime, §3):

```yaml
- uses: ./.github/workflows/actions/quarto-dev        # ALWAYS (harness runtime)

- name: Set up release quarto                          # release mode
  if: inputs.quarto-install == 'release'
  uses: quarto-dev/quarto-actions/setup@v2
  with: { version: "${{ inputs.quarto-version }}" }

- name: Download built quarto artifact                 # artifact mode
  if: inputs.quarto-install == 'artifact'
  uses: actions/download-artifact@v7
  with: { name: "${{ inputs.quarto-artifact-name }}" }
- name: Install built quarto outside the checkout      # artifact mode
  if: inputs.quarto-install == 'artifact'
  run: |                                               # extract OUTSIDE repo (§3 dev-mode trap)
    mkdir -p "$RUNNER_TEMP/quarto-under-test"
    tar -xzf built-quarto-*.tar.gz -C "$RUNNER_TEMP/quarto-under-test" --strip-components=1
    echo "$RUNNER_TEMP/quarto-under-test/bin" >> "$GITHUB_PATH"

- name: Pin and verify test target                     # both non-dev modes
  if: inputs.quarto-install != 'dev'
  run: |
    v="$(quarto --version)"
    [ "$v" != "99.9.9" ] || { echo "dev sentinel detected"; exit 1; }
    echo "QUARTO_TEST_BIN=$(command -v quarto)" >> "$GITHUB_ENV"
```

Everything downstream is untouched: `quarto install tinytex/verapdf/…`
pick up the PATH override automatically; `run-tests.sh` reads
`QUARTO_TEST_BIN` from the env; language setup is shared.

### 5.2 New `test-smokes-built.yml`

```yaml
name: Smoke Tests (Built Version)
on:
  schedule: [{ cron: "0 8 * * 1" }]     # weekly, Monday
  workflow_dispatch:
    inputs:
      source:  { type: choice, options: [build, release], default: build }
      version: { type: string, default: "pre-release" }  # for source: release

jobs:
  build-artifact:            # source: build (default; also the schedule path)
    if: inputs.source != 'release'
    runs-on: ubuntu-latest
    outputs: { sha: "${{ steps.rec.outputs.sha }}" }
    steps:
      - uses: actions/checkout@v6
      - id: rec
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
      - run: ./configure.sh
      - run: |
          pushd package/src
          ./quarto-bld prepare-dist \
            --set-version "$(cat ../../version.txt).$(date +%Y%m%d)-test" \
            --log-level info
          popd
      - run: |                                   # same recipe as make-tarball
          pushd package
          mv pkg-working quarto-built-test
          tar czf built-quarto-linux-amd64.tar.gz quarto-built-test
          mv quarto-built-test pkg-working
          popd
      - uses: actions/upload-artifact@v7
        with: { name: built-quarto-linux-amd64,
                path: package/built-quarto-linux-amd64.tar.gz }

  run-smokes-artifact:
    if: inputs.source != 'release'
    needs: [build-artifact]
    uses: ./.github/workflows/test-smokes.yml
    with:
      ref: "${{ needs.build-artifact.outputs.sha }}"   # harness == binary commit
      quarto-install: artifact
      quarto-artifact-name: built-quarto-linux-amd64

  run-smokes-release:                                  # dispatch-only, curative/backfill
    if: inputs.source == 'release'
    uses: ./.github/workflows/test-smokes.yml
    with:
      ref: "refs/tags/v${{ <resolved version> }}"      # resolve pre-release → concrete tag first
      quarto-install: release
      quarto-version: "${{ inputs.version }}"
```

Notes:

- The version marker embeds `-test` so the built binary can never be
  mistaken for a published build; it also keeps `quarto --version` ≠
  `99.9.9`, satisfying the guard.
- Platform: **linux-amd64 first** (Windows zip needs the signing pipeline;
  Windows coverage comes via `source: release`, or later an unsigned local
  zip build).
- `release` mode needs a small resolve step (input `pre-release`/`release`
  → concrete `1.x.y` via `_prerelease.json`/`_download.json` or the GitHub
  API) before computing the checkout tag.
- Full run duration: the daily `test-smokes.yml` scheduled run already
  does a full un-sharded run per OS, so a weekly built-mode equivalent is
  a known, bounded cost; the `run-parallel-tests` bucket matrix remains
  available if needed.
- Later (Phase 4): call the same parameterized workflow from
  `create-release.yml` as an initially non-blocking gate before
  `publish-release`.

## 6. Phased roadmap

**Phase 0 — spike (≈1 day).** Locally: `configure.sh` +
`quarto-bld prepare-dist`, copy `pkg-working` **outside the checkout**
(§3 dev-mode trap), hack the seam, run ~20–30 representative smoke-all
docs + a few `.test.ts` smokes. Acceptance: catalog of failure classes;
confirmation the log-file contract holds end-to-end; finalized env
allowlist.

**Phase 1 — fixtures + harness binary mode.** Land the ten
`quarto-required` relaxations and the `drafts-env` anti-pattern fix
(standalone, dev-mode no-ops). Implement `runQuarto`, the env contract,
`quartoDevCmd()` change, runner plumbing (incl. `unit/` exclusion),
version guard, `requiresDevQuarto`, the ~14 shared-helper migrations, the
2 file moves to `tests/unit/`. Acceptance: full dev-mode suite still
green (default path untouched); a binary-mode subset green locally.

**Phase 2 — CI.** Parameterize `test-smokes.yml` (additive inputs);
add `test-smokes-built.yml` (weekly + dispatch, build-then-test, full
smoke-all, linux). Acceptance: first green (or triaged) weekly run;
failures classified into product bugs / harness assumptions / dev-only.

**Phase 3 — broaden.** `source: release` path (Windows coverage, version
backfill), ff-matrix bucket job, guard-rail lint checks. Acceptance:
dispatch run against latest published prerelease succeeds on both OSes.

**Phase 4 — optional.** Non-blocking gate in `create-release.yml`;
decouple harness from `src/` (via `quarto inspect`) only if testing
binaries from a *different* commit than the harness ever matters.

## 7. Risks & open items

- **Subprocess startup cost** (~100–300 ms × hundreds of renders): small
  vs render time; measure in Phase 0.
- **`shouldError` + passthrough commands**: `run`/`pandoc`/`typst`
  failures exit non-zero without a log ERROR record (§3); their tests
  already use `execProcess` and don't rely on log verifiers — document
  the constraint in the seam.
- **Behavioral diffs without `QUARTO_DEBUG`**: ERROR messages lose stack
  traces; no known verifier depends on them; Phase 0 confirms.
- **`quarto check` dev branch**: with a real version the
  `git rev-parse`/dev branch is skipped — `check`-based tests
  (`smoke/check`, `env/check`) assert against installed behavior; adapt
  expectations (§4.5).
- **Intra- vs inter-process concurrency**: `issues/9133` reproduces an
  in-process race; the two-subprocess variant needs a runtime check that
  the regression still triggers.
- **`configure.sh` cost in binary-mode CI**: it still downloads the full
  dev toolchain (pandoc, dart-sass, …) the binary won't use — wasted
  minutes, correctness-neutral; optional later flag in `quarto-bld
  configure`.
- **Skip-list drift**: guard-rail greps (§4.5) + `requiresDevQuarto`
  review-time convention.

---

## 8. Appendix — classification sweep (2026-07-17)

All 133 `tests/smoke/**/*.test.ts` read in full: **107 compatible / 24
adapt / 2 dev-only**.

### 8.1 Compatible as-is (107)

Everything funneling through `testQuartoCmd` or its wrappers
(`testRender`, `testSite`, `testProjectRender`, `testManuscriptRender`):
`render` (28/31), `crossref`+`site`+`website` (25/26), `project` (8/8),
`inspect` (5/6), `extensions` (5/7), `yaml`, `ojs`, `use`, `verify`,
`jats`, `book`, `shortcodes`, `search`, `scholar`, `manuscript`, `embed`,
`authors`, `build-ts-extension`, `check`, and more. Their `src/` imports
are expectation/path/cleanup helpers only. `TestContext.env` is already a
parameter (not `Deno.env.set`) and forwards cleanly.

### 8.2 Adapt (24) — four mechanical patterns

(a) direct `quarto()` import (~14 files; greppable) → `runQuarto` helper /
trivial `testQuartoCmd` rewrites; (b) `quartoDevCmd()` PATH spawns
(`run/*`, `lua-unit`, `logging`, `create`) → one-line env-var switch;
(c) hardcoded `../package/dist/bin/quarto` spawns (`filters/
editor-support`, `typst-gather` 7–12) → consolidate onto (b); (d)
semantic one-offs (`env/check` 99.9.9 expectation;
`inspect-standalone-rstudio` in-process hook → `RSTUDIO=1` child env).
Details and per-file notes in §4.5. Note: "uses `unitTest()`" is NOT a
dev-only signal — several files use it as a generic wrapper around
subprocess spawns.

### 8.3 Dev-only (2)

`yaml-intelligence/yaml-intelligence.test.ts` and
`yaml-intelligence-folded-block-strings.test.ts` — in-process
yaml-intelligence internals with no CLI surface → move to `tests/unit/`.

### 8.4 Smoke-all documents

Binary-clean except the ten `quarto-required: '>=99.9.0'` fixtures
(§4.6): no doc executes quarto from a code cell, no runtime dev-tree
paths, no pre/post-render scripts, every `printsMessage` uses
INFO/WARN/ERROR (never DEBUG). Driver adaptations: project pre-renders
(24 docs) and `editor-support-crossref` (2 docs) through `runQuarto`;
tolerate non-zero child exit. One-time runtime checks:
`engine/class-override` (`>=1.9.17` — correctly fails on older release
binaries), `QUARTO_EXECUTE_INFO`/`QUARTO_PROJECT_ROOT` env docs, the
pandoc-args INFO echo docs (`2025/12/09/13775-*`).
