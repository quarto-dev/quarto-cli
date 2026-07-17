# Plan: Running Smoke Tests Against a Built Quarto

Status: **detailed design — v3** (grounded + adversarially reviewed;
ready for Phase 0 spike).

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

Review history: v2 was attacked by a 5-lens adversarial review (19 agents;
every critical/major finding independently verification-checked). All 32
standing findings are folded into this v3; the design-changing ones are
marked **[R]** below.

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
- `smoke-all.test.ts` globs `docs/smoke-all/**/*.{md,qmd,ipynb}`
  (**1424 documents** as of 2026-07-17, many with multiple format specs),
  parses `_quarto.tests` with dev-source YAML code, dispatches spec keys to
  verifiers via an inline `verifyMap`, and renders via
  `testQuartoCmd("render", [input, "--to", format])` (`:462`); project
  pre-renders call `quarto(["render", projectPath])` directly (`:434`).
- The **feature-format matrix is a smoke-all bucket**:
  `test-ff-matrix.yml:44-50` calls `test-smokes.yml` with a qmd glob that
  `run-tests.sh:132-164` routes to `smoke-all.test.ts`. Anything that fixes
  smoke-all fixes the matrix.
- `create-release.yml` builds per-OS artifacts and uploads them as workflow
  artifacts. **[R]** The nightly `schedule` runs are build-only (the
  tag-creating commit and the whole `publish-release` job are gated on
  `inputs.publish-release`, and `inputs` is empty on schedule events);
  published + `v<version>`-tagged (pre)releases come from
  `workflow_dispatch` runs, where `publish-release` defaults to true
  (`create-release.yml:88-100,678-703`). The linux tarball recipe is
  `./configure.sh` → `quarto-bld prepare-dist --set-version <v>` → tar of
  `package/pkg-working` (`create-release.yml:136-159`).

## 2. Strategy

1. **The dev-tree coupling is concentrated in the execution path** — the
   body of `test.execute()` plus the logger lifecycle around it in
   `test()` (two touch points, both in `tests/test.ts`). The verifier
   layer and the `_quarto.tests` dispatch consume only the json-stream log
   file and files on disk, both reproducible by a subprocess via
   `--log <file> --log-format json-stream`.
2. **Version skew is avoided by construction.** The primary workflow builds
   the artifact from the same SHA the harness checks out. For
   published-release testing, check out `refs/tags/v<version>` — with the
   scope limitation in §5.3 **[R]**. The harness keeps importing `src/`
   for *parsing and path math* only; *execution* moves to the binary.

**What this design does NOT test [R]:** signing/notarization, MSI/pkg/deb
installer logic and installer PATH setup, Cloudsmith packages, arm64
tarballs, and (until Phase 3 release mode) the Windows Rust launcher. A
green "Smoke Tests (Built Version)" badge means the linux-amd64 built
*layout* renders correctly — not that release artifacts are safe
end-to-end. Keep this list next to any badge/gate.

## 3. Ground truths verified in code (2026-07-17)

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
  (`log.ts:267-273`).
- On render failure an ERROR record is written before exit 1: errors
  propagate to `mainRunner`'s catch → `logError(e)` (`main.ts:70-73`) →
  ERROR record in the file; then `exitWithCleanup(1)` (`main.ts:74-81`).
  `CommandError` likewise (`src/quarto.ts:202-208`).
- **[R] But "non-zero exit ⇒ ERROR record in the log" is NOT an
  invariant.** It fails for (a) any child failure *before* `mainRunner`'s
  logger init — deno startup errors, bundle/import-resolution failures
  loading the esbuild `quarto.js`, missing modules (`main.ts:26-27` runs
  after the module graph loads; the launcher just execs deno,
  `common/quarto:205-209`); (b) `quarto add`/`remove` failures via
  `commandFailed()`/`signalCommandFailure` → `exitWithCleanup(1)` with
  only INFO output (`src/quarto.ts:199-201`,
  `src/command/add/cmd.ts:48-51,59-61`); (c) the `pandoc`/`typst`/`run`
  passthroughs, which `Deno.exit(code)` and route child stderr directly
  (`src/quarto.ts:100,119,139`). Because the harness pre-creates the log
  file, an untouched log parses to `[]` and `noErrors`/
  `noErrorsOrWarnings` pass **vacuously** — and ~23% of smoke-all docs
  (326/1424) use the default log-only spec with no file verifier. The
  seam therefore MUST synthesize an ERROR record for record-free non-zero
  exits (§4.1) — otherwise the exact failure class binary mode exists to
  catch (broken bundle, missing share) reports green on those docs.

**`QUARTO_FORCE_VERSION=99.9.9` is rejected (do not use):** honored at
`src/core/quarto.ts:34-45` but `99.9.9` equals `kLocalDevelopment`, which
(a) satisfies every lower-bound version gate (extensions
`src/extension/extension.ts:776-788`, document `quarto-required`
`src/command/render/render-files.ts:130-144`, engines
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
path; sibling extensions in the same `_extensions/` dirs use `>=1.3.0`,
as does upstream `quarto-ext/lipsum` and Quarto's own bundled copy
(`src/resources/extensions/quarto/lipsum/_extension.yml:4`). **All ten
are safe to relax.**

**[R] Semver behavior of version markers (verified by executing the
vendored `deno.land/x/semver@v1.4.0`):** `satisfies()` **throws** on
non-semver strings (no try/catch around `new SemVer` in `Range.test`,
unlike node-semver), and **prerelease versions do not satisfy plain
ranges** (`1.10.16-test` fails `>=1.9`; no call site passes
`includePrerelease`). Only **build metadata** (`1.10.15+test.20260717`)
is both valid and range-transparent. This dictates the §5.2 version
marker.

**Launcher & env behavior:**

- The installed bash launcher inherits `QUARTO_SHARE_PATH` and
  `QUARTO_DEBUG` if already set (`package/scripts/common/quarto:102-110,
  68-70`; `quarto.cmd:80-81, 47`), recomputes `QUARTO_ROOT`/
  `QUARTO_BIN_PATH` unconditionally, **never sets `DENO_DIR` outside dev
  mode**, and inherits `QUARTO_DENO` and `QUARTO_DENO_DOM`
  (`common/quarto:167-173`) — note it is `QUARTO_DENO_DOM` that is
  inherited; `DENO_DOM_PLUGIN` itself is unconditionally overwritten by
  both launchers **[R]**.
- **Dev-mode trap:** the bash/cmd launchers decide dev vs installed by
  finding a sibling `src/quarto.ts` relative to their own path
  (`common/quarto:22-37`). `QUARTO_TEST_BIN` pointing at the in-repo
  `package/dist/bin/quarto` silently runs **dev mode** (TS sources,
  `--check`, dev env defaults). The dist must be extracted **outside the
  git checkout**, and the seam must fail loudly if `<bin> --version`
  reports `99.9.9`.
- **Windows built layout ships two entry points.** `prepare-dist` copies
  `quarto.cmd` into the dist (`copyQuartoScript`,
  `package/src/common/configure.ts:143-149`); the `make-installer-win`
  job additionally builds and signs the **Rust launcher `quarto.exe`**
  (`package/launcher/src/main.rs`; `create-release.yml:350-429`) — what
  the MSI/zip put on PATH, i.e. what Windows users actually run.
  `QUARTO_TEST_BIN` should target `quarto.exe` for published-release
  testing; a `prepare-dist`-only Windows artifact has `quarto.cmd`, which
  spawns **directly** with `Deno.Command` — no `cmd /c` (established
  pattern: `quartoDevCmd()` `tests/utils.ts:244-246`). The Rust launcher
  has **no dev-mode branch**, reads `--version` straight from
  `share/version`, and inherits `QUARTO_SHARE_PATH`, `QUARTO_DENO`, and
  `QUARTO_DENO_DOM` from the environment (`main.rs:21-23,50-60,65-68`).
- A genuinely installed binary runs a single esbuild-bundled `quarto.js`
  with `--no-check` (`common/quarto:91-121, 205-208`), a real
  `share/version` file, inlined Lua filters, and arch-specific
  deno/deno_dom (`package/src/common/prepare-dist.ts:128-147, 191-224`).
  Binary mode covers bundling/import-resolution errors, missing share
  resources, version wiring, and the `--no-check` gap.
- `QUARTO_DEBUG=true` (dev default) adds stack traces to ERROR `msg` text
  (`src/core/log.ts:371-386`) plus dev-only reconfigure/watch paths.
  Binary mode spawns the child **without** it. ERROR counts are
  unaffected; no smoke-all `printsMessage` depends on stack text.

**CI structure:**

- `run-tests.sh` hardcodes the harness runtime at
  `package/dist/bin/tools/<arch>/deno` + `package/dist/bin/deno_cache` +
  `src/import_map.json` (`run-tests.sh:47,57,164`), all produced only by
  `configure.sh`. **Consequence: the `quarto-dev` action must run in
  every CI mode** — it provisions the harness runtime; the built binary
  is added *on top* (PATH override + `QUARTO_TEST_BIN`), not substituted.
  **[R]** Nuance: this "never uses PATH quarto" claim is CI-scoped —
  local runs source `configure-test-env.sh` (which calls PATH `quarto
  install tinytex/verapdf`) unless `QUARTO_TESTS_NO_CONFIG` is set; the
  Phase 0/1 local recipe must set it or order PATH deliberately.
- The dev quarto reaches PATH via a `/usr/local/bin` symlink on
  Linux/macOS (`package/src/common/configure.ts:81-133`,
  `suggestUserBinPaths`) and via a `GITHUB_PATH` append of
  `package/dist/bin` on Windows CI **[R]**; in both cases a later
  `$GITHUB_PATH` prepend shadows it for subsequent steps, so
  `quarto install tinytex/verapdf/chrome-headless-shell`
  (`test-smokes.yml:236,243,251`) and PATH-based tests automatically use
  the binary under test. `merge-extension-tests` is a plain `cp -r` —
  mode independent.
- **[R]** `prepare-dist` populates `package/pkg-working` (disjoint from
  `package/dist`; `package/src/common/config.ts:65-89`) **but also
  regenerates artifacts inside `src/`** (quarto-preview JS via
  `build.ts --force`; schema/yaml-intelligence assets under
  `src/resources` via `buildAssets()`), so a build job and a test run
  sharing one checkout can race on the harness's own
  `QUARTO_SHARE_PATH=src/resources`. Separate build/test jobs (the
  chosen design) are the mitigation, not merely a preference.
  `configure.sh` + `prepare-dist` need network (public URLs) but **no
  secrets** for the linux tarball.

## 4. Design — harness "binary mode"

Activated by `QUARTO_TEST_BIN=<abs path to installed quarto | quarto.exe |
quarto.cmd>` (on Windows prefer `quarto.exe` — what releases ship, §3).
Unset ⇒ current behavior, byte-for-byte unchanged.

### 4.1 The execution seam (`tests/quarto-cmd.ts` + `tests/test.ts`)

```ts
export function binaryMode(): string | undefined;

export async function runQuarto(
  args: string[],
  options?: {
    env?: Record<string, string>;
    cwd?: string;
    logFile?: string;            // json-stream target (binary mode)
    timeoutMs?: number;
    throwOnFailure?: boolean;    // [R] default TRUE for direct call sites
    logLevel?: string;           // [R] honor per-test log intent
  },
): Promise<void>
```

- **Dev branch** (no `QUARTO_TEST_BIN`): call in-process `quarto(args,
  undefined, options?.env)` exactly as today.
- **Binary branch**: spawn the binary with
  `--log <logFile> --log-format json-stream --log-level <level ?? info>`
  appended — but **only** for seam-driven invocations; never for tests
  that spawn quarto themselves and own their flags
  (`logging/log-level-and-formats.test.ts`). **[R]** If a test overlays
  `QUARTO_LOG_LEVEL` via `context.env` or passes `logConfig`, the seam
  uses that level/format for the flags instead of silently overriding
  (flags beat env in `logOptions`, so passing the env var through is not
  enough).
- **[R] Failure semantics — the silent-green invariant.** The seam never
  relies on "child exited non-zero ⇒ ERROR record exists" (§3). After the
  child exits: parse the log; if exit ≠ 0 **and** the parsed records
  contain no ERROR-level entry, append a synthetic ERROR record (exit
  code + stderr tail) to the log before verification. With that
  guarantee:
  - `test.execute()` uses `throwOnFailure: false` (mirrors today's
    catch-and-log, `test.ts:262-266`); verifiers see the synthetic record.
  - **Direct call sites keep throw semantics** (`throwOnFailure: true`,
    the default): the smoke-all module-level project pre-render and the
    `context.setup` pre-renders (`render-freeze`, extension installs, …)
    run *outside* the test try/catch today and fail loudly on error —
    a never-throwing helper would convert those into false greens against
    stale outputs.
- **[R] stdout/stderr**: pipe both and drain concurrently (undrained
  pipes deadlock at 64 KiB on verbose renders — the child runs without
  `--quiet`, so its StdErr handler emits all progress). Keep the stderr
  tail for the synthetic ERROR record and for failure reports. Do not
  pass `--quiet` (shipped console behavior stays exercised and available
  for triage).
- **[R] Timeout kills the process tree, not the direct child.**
  `QUARTO_TEST_BIN` is a launcher; the bash script and `quarto.exe` both
  spawn-and-wait on deno (`common/quarto:205-209` does not `exec`), so
  `child.kill()` orphans the actual renderer — which also still holds
  the log file at its own offset (mode `"w"`, no `O_APPEND`), corrupting
  any harness-appended record. Implementation: POSIX — spawn in its own
  process group and signal the group (or, better long-term, change the
  installed launcher's non-dev branch to `exec "${QUARTO_DENO}" …`, a
  one-line shipped improvement); Windows — `taskkill /PID <pid> /T /F`.
  Append the timeout ERROR record only after the tree is confirmed dead.
- **[R] Logger lifecycle in `test()`**: in binary mode, `test()` skips
  `initializeLogger`/`cleanupLogger`/`flushLoggers` entirely (the child
  owns the log file), and the execute-catch appends a synthetic ERROR
  record to the file instead of calling `logError` (which, with no
  initialized logger, would go to the console handler and — worse —
  `cleanupLogger()` would permanently destroy the default handlers for
  subsequent tests in the same file).
- `testQuartoCmd`'s `cwd` context keeps chdir-ing the harness process
  (relative-path verifiers and teardowns depend on it) *and* passes cwd
  to the subprocess.
- Startup guard, once per run: execute `<bin> --version`; **fail hard**
  on `99.9.9` (dev-mode trap) or mismatch with
  `QUARTO_TEST_EXPECTED_VERSION` when provided; print the banner.

### 4.2 Env contract for the spawned binary

**[R] Mechanism: inherit ambient env + strip, not `clearEnv` +
allowlist.** The v2 `clearEnv` design required enumerating every var the
toolchains need; the Windows system-var surface alone (`SystemRoot`,
`ComSpec`, `PATHEXT`, `APPDATA`, `LOCALAPPDATA`, `ProgramData`,
`PROGRAMFILES`, `windir`, …) is large, failure modes are obscure
(CPython misbehaves without `SystemRoot`; TinyTeX resolves from
`APPDATA` — `tinyTexInstallDir()`; `quartoDataDir()` is
`LOCALAPPDATA`-based for chrome-headless-shell/verapdf), and a
linux-only Phase 0 cannot validate it. The dangerous set is the small,
known one. Contract:

1. **Inherit** the ambient environment (toolchain vars `QUARTO_R`,
   `QUARTO_PYTHON`, `QUARTO_TYPST`, `QUARTO_ESBUILD`,
   `QUARTO_DART_SASS`, `QUARTO_CHROMIUM`, `QUARTO_TEXLIVE_BINPATH`,
   `QUARTO_TINYTEX_REPOSITORY`, `QUARTO_KNITR_RSCRIPT_ARGS` are ambient
   CI env and flow through, as do PATH/HOME/locale/proxy/venv/renv/Julia
   and all platform system vars).
2. **Strip** (dev-tree identity + stale-leak guards):
   `QUARTO_SHARE_PATH`, `QUARTO_BIN_PATH`, `QUARTO_DEBUG`, `DENO_DIR`,
   `QUARTO_DENO`, `QUARTO_DENO_DOM` **[R]**, `QUARTO_ROOT`,
   `QUARTO_SRC_PATH`, `QUARTO_FORCE_VERSION`,
   `QUARTO_VERSION_REQUIREMENT`, `QUARTO_PROJECT_DIR`, `QUARTO_PROFILE`
   (unless test-provided), `QUARTO_LOG`/`_LEVEL`/`_FORMAT` (seam owns
   logging via flags), `RSTUDIO` (must be affirmatively absent for the
   "not RStudio" test).
3. **Overlay `context.env` last** (per-test intent wins):
   `QUARTO_PROFILE`, `QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES/
   _OUTPUT_FILES`, `QUARTO_PDF_STANDARD`, `RSTUDIO=1`, `LUA_PATH`, etc.

**[R]** The same strip must apply to the `quartoDevCmd()`/`execProcess`
spawns once they target `QUARTO_TEST_BIN` (§4.5b/c) — the one-line
path switch alone leaves them inheriting `DENO_DIR` etc. Route them
through a shared `spawnQuartoEnv()` helper.

### 4.3 smoke-all driver changes (`tests/smoke/smoke-all.test.ts`)

- Route the project pre-render (`:434`; `throwOnFailure: true`) and the
  `editor-support-crossref` pseudo-format (2 docs) through `runQuarto`.
- Everything else (discovery, `_quarto.tests` parsing, `verifyMap`
  dispatch, cleanup, `run:` skip logic) is harness-side and unchanged.
- The YAML-intelligence bootstrap stays (harness-process-only).

### 4.4 Runner plumbing (`run-tests.sh` / `run-tests.ps1`)

When `QUARTO_TEST_BIN` is set (or `--bin <path>` given):

- Still resolve the repo Deno + import map — the harness always needs
  them. **[R] Keep exporting `QUARTO_SHARE_PATH` (and the dev env
  generally) for the harness process in ALL modes** — the harness itself
  requires it (`smoke-all.test.ts`'s module-level
  `initYamlIntelligenceResourcesFromFilesystem()` →
  `quartoConfig.sharePath()` → `getenv()` **throws** when unset,
  `src/core/env.ts:9-16`). Child isolation is achieved solely by the
  §4.2 strip, applied at spawn time.
- **[R] Default test selection**: `run-tests.sh` cannot take a directory
  argument today (the arg-validation loop rejects non-`.ts`/doc paths
  and exits 1). In binary mode, set `TESTS_TO_RUN` internally to the
  smoke tree, and classify `tests/integration/*.test.ts` explicitly
  (include or document as dev-only) rather than losing them silently.
  `tests/unit/` is excluded (dev-only by definition).
- Print the `<bin> --version` banner; refuse `99.9.9` (§4.1 guard).
- Local recipe: set `QUARTO_TESTS_NO_CONFIG=true` (or order PATH
  deliberately) so `configure-test-env.sh` doesn't invoke a PATH
  `quarto` you didn't intend (§3 **[R]**).

### 4.5 Test adaptations (from the 133-file classification, §8)

- **Shared-helper migrations** (~14 files importing `src/quarto.ts`):
  replace direct `quarto()` calls with `runQuarto` (setup pre-renders
  keep throw semantics — §4.1 **[R]**). Trivial `testQuartoCmd` rewrites
  where possible (`jupyter/issue-10097`, `issue-12374`).
  `engine/invalid-engine-in-project` converts from `assertRejects`
  (currently un-awaited — a latent bug) to exit-code + ERROR-log
  assertion.
- **`quartoDevCmd()` switch** (`tests/utils.ts:244`): return
  `QUARTO_TEST_BIN` when set — migrates `run/*`, `lua-unit`, `logging`,
  `create`; consolidate the hardcoded `../package/dist/bin/quarto`
  spawns (`filters/editor-support`, `typst-gather`) onto it. **[R]**
  Pair the switch with the shared env-strip helper (§4.2) — the path
  change alone is insufficient.
- **Semantic one-offs**: `env/check.test.ts` — compute expected version
  from the binary instead of hardcoding `99.9.9`;
  `inspect-standalone-rstudio` — `RSTUDIO=1` via `context.env` in binary
  mode.
- **Anti-pattern fix**: `website/drafts-env.test.ts` converts
  `Deno.env.set("QUARTO_PROFILE", ...)` to `context.env`.
- **Move, don't flag**: the 2 dev-only files
  (`yaml-intelligence/yaml-intelligence.test.ts`,
  `yaml-intelligence-folded-block-strings.test.ts`) move to
  `tests/unit/`. `TestContext.requiresDevQuarto` is added as an escape
  hatch (sets Deno `ignore` in binary mode), starting with zero users.
- **Guard rails** (lint/CI checks): forbid `import ... from
  ".*src/quarto.ts"` under `tests/smoke/`; forbid quarto spawns not
  routed through `quartoDevCmd()`/`runQuarto`.

### 4.6 Fixture fixes

- Relax the ten `quarto-required: '>=99.9.0'` fixture extensions to
  `'>=1.9'` (evidence in §3; matches their sibling extensions). Safe,
  standalone, dev-mode no-ops (`99.9.9 >= 1.9`) — can land first.

## 5. CI design

### 5.1 Parameterize `test-smokes.yml`

New `workflow_call` inputs: `quarto-install` (`dev`|`release`|`artifact`,
default `dev`), `quarto-version`, `quarto-artifact-name`, `ref`
(checkout ref), and **[R]** `runners` (JSON list for the OS matrix,
default `'["ubuntu-latest","windows-latest"]'`). **[R]** `buckets`
changes from `required: true` to `required: false, default: ""` (both
existing callers always pass it — behavior-neutral).

Additional adjustments **[R]**:

- The seven Windows setup steps gated
  `runner.os != 'Windows' || github.event_name == 'schedule'`
  (node/playwright/multiplex) must also fire for full non-dev runs
  (`inputs.quarto-install != 'dev'`), or a dispatch-triggered full
  Windows release-mode run executes in an environment no full Windows
  run has ever used.
- All new steps carry `shell: bash` explicitly (they run on the Windows
  leg too).

Step changes — inserted after the existing `quarto-dev` step
(`test-smokes.yml:230`), which runs **unconditionally in every mode**
(harness runtime, §3):

```yaml
- uses: ./.github/workflows/actions/quarto-dev        # ALWAYS

- name: Set up release quarto
  if: inputs.quarto-install == 'release'
  uses: quarto-dev/quarto-actions/setup@v2
  with: { version: "${{ inputs.quarto-version }}" }

- name: Download built quarto artifact
  if: inputs.quarto-install == 'artifact'
  uses: actions/download-artifact@v8                  # repo standard [R]
  with: { name: "${{ inputs.quarto-artifact-name }}" }
- name: Install built quarto outside the checkout
  if: inputs.quarto-install == 'artifact'
  shell: bash
  run: |                                              # outside repo (§3 dev-mode trap)
    mkdir -p "$RUNNER_TEMP/quarto-under-test"
    tar -xzf built-quarto-*.tar.gz -C "$RUNNER_TEMP/quarto-under-test" --strip-components=1
    echo "$RUNNER_TEMP/quarto-under-test/bin" >> "$GITHUB_PATH"

- name: Pin and verify test target
  if: inputs.quarto-install != 'dev'
  shell: bash
  run: |
    v="$(quarto --version)"
    [ "$v" != "99.9.9" ] || { echo "dev sentinel detected"; exit 1; }
    echo "QUARTO_TEST_BIN=$(command -v quarto)" >> "$GITHUB_ENV"
```

`quarto install tinytex/verapdf/…` pick up the PATH override
automatically; language setup is shared.

### 5.2 New `test-smokes-built.yml`

```yaml
name: Smoke Tests (Built Version)
on:
  workflow_run:                         # daily: after each nightly build (§5.2b, §6 Phase 5)
    workflows: ["Build Installers"]
    types: [completed]
  workflow_dispatch:
    inputs:
      source:  { type: choice, options: [build, nightly, release], default: build }
      version: { type: string, default: "pre-release" }  # for source: release

jobs:
  build-artifact:            # source: build (default; also the schedule path)
    if: >
      (github.event_name != 'schedule' || github.repository == 'quarto-dev/quarto-cli')
      && (github.event.inputs.source != 'release')      # fork guard [R]
    runs-on: ubuntu-latest
    outputs: { sha: "${{ steps.rec.outputs.sha }}" }
    steps:
      - uses: actions/checkout@v6
      - id: rec
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
      - run: ./configure.sh
      - run: |                                          # [R] BUILD METADATA marker —
          pushd package/src                             # semver-valid, range-transparent,
          ./quarto-bld prepare-dist \                   # still != 99.9.9. NEVER use a
            --set-version "$(cat ../../version.txt)+test.$(date +%Y%m%d)" \
            --log-level info                            # '-prerelease' suffix or a 4th
          popd                                          # component (both fail all gates)
      - run: |
          pushd package
          mv pkg-working quarto-built-test
          tar czf built-quarto-linux-amd64.tar.gz quarto-built-test
          mv quarto-built-test pkg-working
          popd
      - uses: actions/upload-artifact@v7
        with: { name: built-quarto-linux-amd64,
                path: package/built-quarto-linux-amd64.tar.gz }

  run-smokes-artifact:
    if: github.event.inputs.source != 'release'
    needs: [build-artifact]
    uses: ./.github/workflows/test-smokes.yml
    with:
      ref: "${{ needs.build-artifact.outputs.sha }}"    # harness == binary commit
      quarto-install: artifact
      quarto-artifact-name: built-quarto-linux-amd64
      runners: '["ubuntu-latest"]'                      # linux only [R]
      buckets: ""                                       # full run [R]

  resolve-release:                                      # [R] resolve step needs its
    if: github.event.inputs.source == 'release'         # own job (uses:-jobs have no steps)
    runs-on: ubuntu-latest
    outputs: { version: "${{ steps.r.outputs.version }}" }
    steps:
      - id: r
        run: |  # input 'pre-release'/'release' -> concrete 1.x.y via _prerelease.json/_download.json
          ...

  run-smokes-release:
    if: github.event.inputs.source == 'release'
    needs: [resolve-release]
    uses: ./.github/workflows/test-smokes.yml
    with:
      ref: "refs/tags/v${{ needs.resolve-release.outputs.version }}"
      quarto-install: release
      quarto-version: "${{ needs.resolve-release.outputs.version }}"
      buckets: ""
```

**[R] Version-marker guard**: Phase 0 asserts (with the vendored semver)
`satisfies("<marker>", ">=1.3.0") === true` before adopting any marker;
the CI "Pin and verify" step gains the same assertion.

### 5.2b `source: nightly` — signed artifacts from a no-publish create-release run

Studied post-review (maintainer suggestion): the signing steps in
`make-installer-win` are **unconditional** — not gated on
`publish-release` — so every create-release run, including the nightly
no-publish schedule, already uploads a **signed** `Windows Zip` (the real
`quarto.exe`) and the linux `Deb Zip` as workflow artifacts. The
implemented `source: nightly` mode — **the `workflow_run` path, firing
daily after each completed nightly build** (a scheduled `build` would
duplicate what create-release built hours earlier, unsigned and
linux-only; `build` stays dispatch-only for arbitrary refs and forks) —
reuses them: resolve a
create-release run (explicit `run-id` input or latest successful), check
out its `head_sha` for the harness (same-commit, no skew), download the
artifacts cross-run (`test-smokes.yml` input `quarto-artifact-run-id` →
`download-artifact` `run-id`/`github-token`), and run the smokes on both
OSes. This is the **preventive Windows coverage** path — signed shipped
binaries, zero extra build/signing infrastructure. The build recipe
itself is also shared now: `.github/actions/build-dist-tarball` is used
by both `create-release.yml` (amd64 + arm64 tarballs) and the `build`
mode, so `build` runs exercise the release recipe by construction.
Constraint: works only for create-release runs whose commit contains the
binary-mode harness (post-merge); the preflight fails clearly otherwise.

### 5.3 Release mode scope **[R]**

Release mode checks out the tag while the *workflow file and local
composite actions* resolve from the checked-out tree. Consequences:

- The harness at the tag must already contain the binary-mode plumbing —
  **no existing tag has it**. Release mode therefore only works for
  releases cut **after Phase 1 merges**. "Backfill any historical
  version" is out of scope (would require the Phase-4 harness/binary
  decoupling: main-branch harness testing an older binary).
- Local-action interface drift is real (`.github/actions/cache-typst` is
  referenced unconditionally and only exists since 2026-05; older tags
  fail with "action not found").
- Add a preflight step that fails with a clear message when the
  checked-out ref lacks `QUARTO_TEST_BIN` support in `tests/run-tests.sh`.

### 5.4 Later (Phase 4+)

Call the parameterized workflow from `create-release.yml` as an
initially non-blocking gate before `publish-release`; revisit the §2
non-goals list before presenting it as a release gate.

## 6. Phased roadmap

**Phase 0 — spike (≈1–2 days).** Locally: `configure.sh` +
`quarto-bld prepare-dist`, copy `pkg-working` **outside the checkout**,
`QUARTO_TESTS_NO_CONFIG=true`, hack the seam, run ~20–30 representative
smoke-all docs + a few `.test.ts` smokes. Acceptance: failure-class
catalog; log-file contract confirmed end-to-end **including the
synthetic-ERROR path** (kill a child mid-render; corrupt the dist and
confirm red, not green); semver marker assertion passes; **measured
per-spawn overhead** (product cold-start, not just process launch — the
corpus is 1424 docs ⇒ 1500+ spawns; if overhead is high, the
`run-parallel-tests` bucket matrix becomes the Phase 2 default rather
than a contingency).

**Phase 1 — fixtures + harness binary mode.** Land the ten
`quarto-required` relaxations and the `drafts-env` fix (standalone,
dev-mode no-ops). Implement `runQuarto` (+ `throwOnFailure`, synthetic
ERROR, tree-kill, stderr capture), the env strip helper, `quartoDevCmd()`
switch, runner plumbing (internal `TESTS_TO_RUN`, `integration/`
classification, version guard), logger-lifecycle branching in `test()`,
`requiresDevQuarto`, the ~14 migrations, the 2 file moves. Acceptance:
full dev-mode suite green (default path untouched); binary-mode subset
green locally; the corrupt-dist scenario fails red.

**Phase 2 — CI.** Parameterize `test-smokes.yml` (§5.1 incl. `runners`,
`buckets` default, Windows-gate fix); add `test-smokes-built.yml`
(dispatch build-then-test, full smoke-all, linux; the scheduled trigger
later became `workflow_run` on the nightly build — §6 Phase 5).
Acceptance: first green (or fully triaged) built-version run; failures
classified into product bugs / harness assumptions / dev-only.

**Phase 3 — broaden.** `source: release` path for releases cut after
Phase 1 (Windows coverage via `quarto.exe`; §5.3 scope), ff-matrix
bucket job, guard-rail lint checks. Acceptance: dispatch run against the
first post-Phase-1 prerelease succeeds on both OSes.

**Phase 4 — optional.** Non-blocking gate in `create-release.yml`;
harness/binary decoupling (via `quarto inspect`) if testing binaries
from a different commit than the harness (incl. true backfill) becomes
worth the drift risk.

**Phase 5 — daily built-version as the primary signal (studied
2026-07-17, maintainer proposal).** Verified: `create-release.yml` can
be dispatched on any branch tip with `publish-release=false` — all
publish/tag/docker/cloudsmith paths are input-gated, secrets are
available on non-default branches (no protected environments), and
`version_commit` resolves empty so jobs build the dispatched ref. The
`smoke-artifacts-only` input makes such branch builds cheap (linux
tarball + signed Windows zip only). Implemented now (additive — Phase
A): `test-smokes-built.yml` triggers via **`workflow_run` after every
nightly create-release build** (once per build, no stale-artifact
risk; a failed build means a visibly skipped day, not a silent stale
test) and gained a **macOS leg** from the nightly `Mac Zip` — the only
macOS smoke coverage in CI. Remaining maintainer decisions, AFTER a
green track record (~2 weeks): (Phase B) give `unit/` + `integration/`
(74 files, currently covered by every PR run) a cheap dedicated daily
dev job so they keep daily env-drift coverage; (Phase C) downgrade the
daily dev `test-smokes.yml` cron to weekly — not delete: a weekly dev
run keeps the dev-only classes covered (QUARTO_DEBUG paths, `quarto
check` dev branch, in-process races, Windows playwright setup) and the
safety net for paths-ignored doc-only PRs.

## 7. Risks & open items

- **Per-spawn cost at corpus scale**: 1500+ spawns × product cold-start
  (bundle load, schema init) — measured in Phase 0; bucket-matrix
  sharding is the fallback.
- **Binary-only flakiness classes**: jupyter daemon behavior across
  separate quarto processes, per-process knitr/renv startup, memory/CPU
  contention under deno-test parallelism — watch in Phase 2 triage.
- **`shouldError` + passthrough/add/remove commands**: §3's record-free
  non-zero exits are handled by the synthetic-ERROR invariant; the
  passthrough tests keep their own `execProcess` assertions.
- **`quarto check` dev branch**: with a real version the dev branch is
  skipped — `check`-based tests assert against installed behavior (§4.5).
- **Intra- vs inter-process concurrency**: `issues/9133` reproduces an
  in-process race; the two-subprocess variant needs a runtime check that
  the regression still triggers.
- **`configure.sh` cost in binary-mode CI**: still downloads the dev
  toolchain the binary won't use — wasted minutes, correctness-neutral.
- **Skip-list drift**: guard-rail greps + `requiresDevQuarto` convention.
- **Scope honesty**: keep the §2 "does not test" list current.

---

## 8. Appendix — classification sweep (2026-07-17)

All 133 `tests/smoke/**/*.test.ts` read in full: **107 compatible / 24
adapt / 2 dev-only**. (`tests/integration/*.test.ts` — 3 files — were
outside this sweep and get classified in Phase 1, §4.4.)

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
(`run/*`, `lua-unit`, `logging`, `create`) → env-var switch **plus the
shared env-strip helper (§4.2)**; (c) hardcoded
`../package/dist/bin/quarto` spawns (`filters/editor-support`,
`typst-gather` 7–12) → consolidate onto (b); (d) semantic one-offs
(`env/check` 99.9.9 expectation; `inspect-standalone-rstudio` in-process
hook → `RSTUDIO=1` child env). Note: "uses `unitTest()`" is NOT a
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
INFO/WARN/ERROR (never DEBUG). Corpus: 1424 docs; ~326 use the default
log-only spec (the silent-green exposure §3 [R] closes); 1032 of the
1098 spec-bearing docs also have file-content verifiers that fail loudly
when nothing renders. Driver adaptations: project pre-renders (24 docs)
and `editor-support-crossref` (2 docs) through `runQuarto`. One-time
runtime checks: `engine/class-override` (`>=1.9.17`),
`QUARTO_EXECUTE_INFO`/`QUARTO_PROJECT_ROOT` env docs, the pandoc-args
INFO echo docs (`2025/12/09/13775-*`).
