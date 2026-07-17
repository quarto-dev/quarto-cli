# Plan: Running Smoke Tests Against a Built Quarto

Status: **proposal / plan** — no implementation yet.

Goal: be able to run the existing smoke test suites — at minimum `smoke-all`
and the feature-format matrix — against a **built** Quarto (a GitHub
prerelease/release, or an installer artifact produced earlier in the same CI
run), instead of only the dev source tree.

---

## 1. How testing works today (findings)

### 1.1 The harness runs Quarto in-process

- `testQuartoCmd` does **not** spawn a `quarto` binary. It imports the CLI
  entry point and calls it as a function inside the Deno test process:
  - `tests/test.ts:13` — `import { quarto } from "../src/quarto.ts";`
  - `tests/test.ts:159-162` — `await Promise.race([quarto([cmd, ...args], undefined, context?.env), timeout])`
- `tests/run-tests.sh` launches the repo-bundled Deno with
  `--importmap=src/import_map.json`, `--allow-all`, `--unstable-kv --unstable-ffi`
  (`run-tests.sh:57,63,164`) and exports source-tree paths:
  `QUARTO_BIN_PATH=package/dist/bin` (`:47`),
  `QUARTO_SHARE_PATH=src/resources` (`:60`), `QUARTO_DEBUG=true` (`:61`).
- The only subprocess seam today is `quartoDevCmd()` (`tests/utils.ts:244`,
  returns `"quarto"`/`"quarto.cmd"` from `PATH`), used by a handful of
  passthrough/Playwright tests — not by the render harness.

### 1.2 Output capture and verification are already execution-agnostic

- Before each test, the harness redirects Quarto's logger to a temp file in
  `json-stream` format (`tests/test.ts:243-249`). After execution it parses
  the file line-by-line into `ExecuteOutput { msg, level, levelName }`
  (`test.ts:176-180, 386-392`) and hands that array to every verifier.
- `noErrors` / `noErrorsOrWarnings` / `shouldError` / `printsMessage` only
  inspect those log records (`tests/verify.ts:107-205`).
- Errors thrown by `execute()` are caught and converted into ERROR log
  records before verification (`test.ts:262-266`), so verifiers never depend
  on exceptions from the in-process call.
- All file-content verifiers (`ensureHtmlElements`, `ensureFileRegexMatches`,
  `ensureLatexFileRegexMatches`, docx/pptx/pdf/jats/odt checks, snapshots…)
  read produced files off disk and do not care how Quarto ran.
- Crucially, the **CLI already exposes the same logging pipeline as flags**:
  `--log <file> --log-format json-stream --log-level info`
  (`src/core/log.ts:28,66-67,116,447`). A subprocess can therefore produce a
  byte-compatible log file for the existing verifiers.

### 1.3 smoke-all specifics

- `tests/smoke/smoke-all.test.ts` globs `docs/smoke-all/**/*.{md,qmd,ipynb}`
  (`:378-386`), parses `_quarto.tests` metadata with **dev-source code**
  (`readYamlFromMarkdown` from `src/core/yaml.ts`, `jupyterNotebookToMarkdown`
  from `src/command/convert/jupyter.ts`, `:399-401`), maps spec keys to
  verifiers via an inline `verifyMap` (`:189-218`), and calls
  `testQuartoCmd("render", [input, "--to", format], ...)` (`:462`). It also
  calls `quarto(["render", projectPath])` directly for project pre-renders
  (`:434`).
- `tests/utils.ts` (`outputForInput`, `findProjectOutputDir`, …) re-implements
  Quarto's output-path rules in harness code (`utils.ts:100-208`).
- The YAML-intelligence bootstrap (`initYamlIntelligenceResourcesFromFilesystem`,
  `setInitializer`/`initState`, `smoke-all.test.ts:64-66,463-466`) exists only
  because Quarto runs in-process.

### 1.4 Feature-format matrix = a smoke-all bucket

- `.github/workflows/test-ff-matrix.yml:44-50` reuses `test-smokes.yml` with
  `buckets: '[ "../dev-docs/feature-format-matrix/qmd-files/**/*.qmd" ]'`.
  The bucket loop calls `./run-tests.sh "$file"` which routes `.qmd` args to
  `smoke-all.test.ts` (`run-tests.sh:132-164`). The 0/1/2 quality ratings are
  display-only (`create_table.py`); CI enforces only the `_quarto.tests` specs.
- So: **anything that makes smoke-all work against a built binary makes the
  feature-format matrix work too.**

### 1.5 CI today

- `test-smokes.yml` sets up all language deps inline (R/renv, Python/uv,
  Julia, TinyTeX, Playwright, …) and then installs the **dev tree** via the
  `quarto-dev` composite action (`configure.sh`; asserts version `99.9.9` —
  `.github/workflows/actions/quarto-dev/action.yml:45-51`).
- `create-release.yml` runs nightly, builds per-OS artifacts
  (`quarto-<v>-linux-amd64.tar.gz`, msi/zip, pkg/tar.gz, deb/rpm), uploads
  them as **workflow artifacts**, publishes them as **GitHub Release assets**
  (prerelease by default), and tags `v<version>` on the exact commit built
  (`create-release.yml:88-100,678-703`).
- The release pipeline already has minimal "test the built artifact" jobs
  (`test-tarball-linux`, `test-zip-win`, `test-zip-mac`): download artifact,
  extract, `quarto check` / `--version` (`create-release.yml:310-348,431-477,548-585`).
  These are natural extension points.
- `test-smokes-parallel.yml` already uses `quarto-dev/quarto-actions/setup@v2`
  with `version: pre-release` — but only to compute test buckets, not to run
  tests (`test-smokes-parallel.yml:59-75`).

---

## 2. Strategy

Two structural insights drive the design:

1. **The coupling to the dev tree is concentrated in one seam** — the body of
   `test.execute()` (the in-process `quarto()` call plus programmatic logger
   init). The entire verifier layer, the `_quarto.tests` dispatch, and the
   failure-reporting machinery consume only (a) the json-stream log file and
   (b) files on disk. Both can be produced identically by a subprocess using
   `--log/--log-format/--log-level`.

2. **Version skew is avoidable by construction.** Every published (pre)release
   is tagged `v<version>` on the commit it was built from. If CI checks out
   the repo **at the tag matching the binary under test**, the harness code,
   test documents, schemas, and `utils.ts` path-derivation logic match the
   binary exactly. The harness may keep importing `src/` for *parsing and
   path math* — only *execution* moves to the binary. This keeps the change
   small and low-risk. (Full decoupling via `quarto inspect` is a later,
   optional phase — see Phase 4.)

So the recommended architecture is: **add a "binary mode" to the existing
harness (subprocess execution behind an env var), keep everything else as-is,
and always pair a built binary with the repo checkout at its own tag.**

---

## 3. Design: binary mode in the harness

### 3.1 The execution seam

Introduce `QUARTO_TEST_BIN` (absolute path to a built `quarto` /
`quarto.cmd`). In `tests/test.ts`:

- When unset → current behavior (in-process `quarto()`), zero change for the
  default dev workflow.
- When set → `test.execute()` spawns the binary via `Deno.Command`:

  ```
  <QUARTO_TEST_BIN> <cmd> <args...> \
      --log <same temp log file> --log-format json-stream --log-level info
  ```

  - Reuse the temp log path already created at `test.ts:243`; skip (or
    no-op) the in-process `initializeLogger` for the subprocess side, but
    keep `logError(e)` able to append harness-side failures (spawn errors,
    timeouts) as ERROR records so existing reporting keeps working.
  - Do **not** throw on non-zero exit: the binary writes its own ERROR
    records to the log, which is exactly what `noErrors`/`shouldError`
    already consume. (Mirrors today's catch-and-log at `test.ts:262-266`.)
  - Timeout: on expiry, kill the child process (an improvement over today,
    where a timed-out in-process render keeps running).
  - `context.env`: pass as subprocess env overlay instead of the
    in-process env juggling in `quarto()` (`src/quarto.ts:163-217`).
  - cwd: pass `Deno.cwd()` (the harness still does `Deno.chdir` for
    `context.cwd`, so inheriting cwd is sufficient).

- **Environment hygiene (critical):** the installed launcher *inherits*
  `QUARTO_SHARE_PATH` if set (`package/scripts/common/quarto:102-108`), and
  `run-tests.sh` exports it pointing at `src/resources`. In binary mode the
  subprocess env must **drop/unset** `QUARTO_SHARE_PATH`, `QUARTO_BIN_PATH`,
  and `QUARTO_DEBUG` so the binary resolves its own installed layout.

### 3.2 smoke-all adjustments

- Route the direct project pre-render `quarto(["render", projectPath])`
  (`smoke-all.test.ts:434`) through the same seam (small helper
  `runQuarto(args)` used by both call sites).
- Metadata parsing, format guessing, and `verifyMap` dispatch stay unchanged
  (they run in the harness process against the matching checkout — see §2.2).
- The YAML-intelligence bootstrap can stay; it is harness-process-only and
  harmless in binary mode.

### 3.3 Runner plumbing

- `run-tests.sh` / `run-tests.ps1`: accept `--bin <path>` (or just honor an
  exported `QUARTO_TEST_BIN`). When set:
  - still resolve the repo Deno + import map to run the *harness* (a repo
    checkout is always required — it holds the tests);
  - skip exporting `QUARTO_SHARE_PATH` / `QUARTO_DEBUG`;
  - print a banner with `<bin> --version` so logs are unambiguous about what
    was tested.

### 3.4 Tests that can't run in binary mode

A full classification sweep of all 133 `tests/smoke/**/*.test.ts` files was
performed (2026-07-17, six parallel agents reading every file; results in
§7). Outcome: **107 compatible as-is, 24 adaptable via a handful of
mechanical patterns, only 2 genuinely dev-only** (both `unitTest()`-based
yaml-intelligence tests that arguably belong in `tests/unit/`).

Mechanism:

- Add `TestContext.requiresDevQuarto?: boolean`; the `test()` wrapper sets
  Deno's `ignore` when binary mode is active. Given the sweep results this
  flag is a rare escape hatch, not a broad annotation campaign.
- Unit tests (`tests/unit/`) are dev-only by definition — excluded wholesale
  in binary mode. The 2 dev-only smoke files should simply **move to
  `tests/unit/`** rather than carry the flag (see §7.3).
- The 24 "adapt" files reduce to shared-helper fixes (§7.2), not per-test
  work.

---

## 4. CI integration

> **Decisions recorded (2026-07-17):** weekly schedule **plus manual
> `workflow_dispatch`**; scope is **full smoke-all** (ff-matrix bucket is a
> nice-to-have addition, not the target); and the primary goal is
> **preventive** — test artifacts *as built*, not only published prereleases
> (which is curative, after the fact). Since `create-release.yml` builds the
> linux tarball with just `./configure.sh` + `quarto-bld prepare-dist
> --set-version` + tar of `package/pkg-working`
> (`create-release.yml:124-159`), the test workflow can **build the artifact
> itself with the exact same steps** and test it in the same run — same
> commit by construction, no version-skew handling, and zero changes to the
> release pipeline.

Modes below funnel through a parameterized `test-smokes.yml`.

### 4.0 Parameterize `test-smokes.yml`

New `workflow_call` inputs:

- `quarto-install`: `dev` (default) | `release` | `artifact`
- `quarto-version`: version/tag string (for `release`), e.g. `1.10.23` or
  `pre-release`
- `quarto-artifact-name`: workflow artifact to download (for `artifact`)

Setup step becomes conditional:

- `dev` → existing `quarto-dev` composite action (unchanged default).
- `release` → `quarto-dev/quarto-actions/setup@v2` with the given version
  (already used elsewhere in this repo: `test-smokes-parallel.yml:59-62`).
- `artifact` → `actions/download-artifact`, extract zip/tarball, add `bin`
  to `PATH` (same recipe as `create-release.yml:310-348`).

For `release`/`artifact`: skip the `99.9.9` dev assertion, instead assert
`quarto --version` equals the expected version, and export
`QUARTO_TEST_BIN=$(command -v quarto)` for the run-tests steps. All
language-dependency setup (R/Python/Julia/TinyTeX/…) is shared and unchanged.

### 4.1 Mode A — build-then-test workflow (primary)

New workflow `test-smokes-built.yml`, **weekly `schedule` + manual
`workflow_dispatch`**, testing an artifact built *in the same run* from the
current `main` (preventive — catches packaging/built-layout breakage before
the nightly `create-release.yml` ships it):

1. **`build-artifact` job** (ubuntu-latest): checkout `main` (record the SHA
   as a job output), then reproduce `make-tarball` exactly
   (`create-release.yml:136-159`):
   `./configure.sh` → `pushd package/src && ./quarto-bld prepare-dist
   --set-version <version> --log-level info` → tar `package/pkg-working` →
   upload as workflow artifact `built-quarto-linux-amd64`. Version string:
   `version.txt` base + a `+test`/run-number marker so it is never confused
   with a published build.
2. **`run-smokes` job**: call the parameterized `test-smokes.yml` with
   `quarto-install: artifact`, `quarto-artifact-name:
   built-quarto-linux-amd64`, **checking out the same SHA** as the build job
   (harness = binary commit, zero skew), and **no buckets** → full run, which
   includes all of smoke-all (`docs/smoke-all/**`) plus the `.test.ts`
   smokes that survive binary mode. Optionally add the ff-matrix bucket
   (`dev-docs/feature-format-matrix/qmd-files/**/*.qmd`) as a second job for
   extra coverage.
3. Platform: **linux-amd64 first**. The Windows zip requires the signing
   pipeline (`make-installer-win`, `create-release.yml:350-429`), so
   Windows coverage comes more easily from the published-prerelease mode
   below (unsigned local zip build is a possible later enhancement).

Cost note: the build job is cheap (`configure.sh` + `prepare-dist`, a few
minutes — same as every `create-release` build job); the expensive part is
the smoke suite itself, which already runs daily in dev mode, so a weekly
built-mode run is a modest addition.

### 4.2 Mode A′ — same workflow, published (pre)release as input

`test-smokes-built.yml` also takes a `workflow_dispatch` input
`source: build (default) | release`, plus `version` (`pre-release`,
`release`, or an explicit `1.x.y`). With `source: release` it skips the
build job, checks out **`refs/tags/v<version>`** (harness matches binary,
§2.2), and calls `test-smokes.yml` with `quarto-install: release`. Use
cases: verifying the bits users actually install (post signing/packaging),
Windows coverage, and backfilling any historical version when bisecting a
regression report ("did 1.9.12 already have this?").

### 4.3 Mode B (later option) — gate inside `create-release.yml`

Once binary mode is stable and the dev-only skip-list has settled, the same
parameterized `test-smokes.yml` can be called from `create-release.yml`
between build and `publish-release` (artifact `Deb Zip`), turning the weekly
preventive check into a true release gate. Recommendation: keep this out of
scope until Mode A has produced a few weeks of clean signal — a flaky gate
on the nightly pipeline is worse than none. Start `continue-on-error: true`
and possibly with a bounded bucket (ff-matrix) rather than full smoke-all to
keep the nightly duration sane.

---

## 5. Phased roadmap

**Phase 0 — spike (≈1 day).** Hack the seam locally (no plumbing polish):
build a dist locally (`configure.sh` + `quarto-bld prepare-dist`), set
`QUARTO_TEST_BIN`, run ~20–30 representative smoke-all docs. Catalog failure
classes (env leakage, path derivation drift, dev-only assumptions). This
validates the log-file contract end-to-end before investing in CI.

**Phase 1 — harness binary mode.** Implement §3 properly: seam in `test.ts`,
`runQuarto` helper for smoke-all, env hygiene, `requiresDevQuarto`,
`run-tests.sh`/`.ps1` plumbing. Default behavior unchanged; add a small CI
sanity job (or manual checklist) that runs a tiny binary-mode bucket to keep
the mode from rotting.

**Phase 2 — Mode A workflow (build-then-test).** Parameterize
`test-smokes.yml` (§4.0); add `test-smokes-built.yml` (weekly +
`workflow_dispatch`) that builds the linux-amd64 dist from `main` and runs
**full smoke-all** against it (§4.1). Triage failures into: real product
bugs caught pre-release (jackpot — this is the point of the project),
harness assumptions (fix), dev-only tests (skip-list).

**Phase 3 — broaden.** Add the `source: release` input path (§4.2) for
published-prerelease testing, Windows coverage, and version backfill; add
the ff-matrix bucket job if wanted. Once several weeks of clean signal
exist, consider Mode B — calling the same suite from `create-release.yml`
as a (initially non-blocking) gate before `publish-release` (§4.3).

**Phase 4 — optional decoupling.** If testing binaries whose version diverges
from the harness checkout ever matters (e.g. running main's test suite
against last stable), replace the remaining `src/` imports in the smoke-all
driver: `quarto inspect` for metadata/format discovery, `@std/fs` glob, and
derive output paths from actual render results instead of `outputForInput`.
This is a bigger refactor with drift risk and is **not** needed for the
matched-commit strategy.

---

## 6. Risks & open questions

- **`QUARTO_DEBUG` behavior differences**: dev runs with `QUARTO_DEBUG=true`;
  a built binary runs without it. Some tests may implicitly depend on debug
  behaviors (stack traces in logs, error formatting). Phase 0 will surface
  these.
- **Version-string assumptions**: anything expecting `99.9.9` (or dev share
  paths) must be conditionalized (`quarto-dev` action assertion, any tests
  matching version output).
- **Windows**: subprocess must invoke `quarto.cmd` (or use `cmd /c`);
  quoting of args with spaces needs care in the `Deno.Command` seam.
- **Per-test subprocess startup cost** (~a few hundred ms × hundreds of
  smoke-all docs) is real but small relative to render time; acceptable.
- **Parallel test files + env vars**: binary mode passes env per-subprocess,
  which is actually *safer* than today's process-global `Deno.env` mutation.
- **Skip-list drift**: `requiresDevQuarto` annotations need a home in review
  guidelines so new dev-only tests get tagged at authoring time.
- **Full smoke-all duration in one job**: the daily dev-mode `test-smokes.yml`
  scheduled run already does a full un-sharded run per OS, so a weekly
  built-mode equivalent is feasible; if it proves too slow, reuse the
  `run-parallel-tests` bucket matrix from `test-smokes-parallel.yml`.
- ~~Decision needed — cadence & blocking-ness~~ **Decided:** weekly schedule
  + manual `workflow_dispatch`; non-blocking (no release gate) until the
  mode has a track record (§4.3).
- ~~Decision needed — scope~~ **Decided:** full smoke-all (ff-matrix bucket
  optional extra), against an artifact **built in the same workflow run**
  (preventive), with published-(pre)release testing as a secondary dispatch
  input (curative/backfill).

---

## 7. Classification sweep results (2026-07-17)

All 133 `tests/smoke/**/*.test.ts` files were read in full and classified
for binary-mode compatibility: **107 compatible / 24 adapt / 2 dev-only**.

### 7.1 Compatible directories (no changes needed)

`render` (28/31), `crossref`+`site`+`website` (25/26), `project` (8/8),
`inspect` (5/6), `extensions` (5/7), `yaml`, `ojs`, `use`, `verify`, `jats`,
`book`, `shortcodes`, `search`, `scholar`, `manuscript`, `embed`, `authors`,
`build-ts-extension`, `check`, and more — everything funneling through
`testQuartoCmd` or its wrappers (`testRender`, `testSite`,
`testProjectRender`, `testManuscriptRender`). Their `src/` imports are
expectation/path/cleanup helpers only. `TestContext.env` is already passed
as a parameter (not `Deno.env.set`), so it forwards cleanly to a subprocess
— binary mode actually *improves* isolation for env-dependent tests.

### 7.2 The 24 "adapt" files — four mechanical patterns

**(a) Direct `quarto()` import from `src/quarto.ts`** (~14 files; greppable
via `from ".*src/quarto.ts"`). Setup-side pre-renders or multi-step bodies:
`render-freeze`, `render-format-extension`, `render-output-file-collision`,
`crossref/syntax`, `extensions/extension-render-{journals,typst-templates}`,
`convert/issue-12318`, `jupyter/{cache,issue-10097,issue-12374}`,
`engine/invalid-engine-in-project`, `self-contained/stdout`, `issues/9133`,
and `smoke-all.test.ts` itself (project pre-render). Fix: one shared
`runQuarto(args, {env, cwd})` helper dispatching to in-process `quarto()`
or a `QUARTO_TEST_BIN` spawn; three of these are trivial rewrites to plain
`testQuartoCmd`. Notes: `invalid-engine-in-project` asserts on a thrown
Error (convert to exit-code + ERROR-log assertion; its `assertRejects` is
currently not awaited, so it silently passes today — a pre-existing bug);
`issues/9133` reproduces an *intra*-process concurrency bug, so the
two-subprocess version needs a runtime check that it still triggers.

**(b) PATH-quarto subprocess via `quartoDevCmd()`** (`run/*` ×3,
`lua-unit`, `logging`, `create`): a **one-line fix** — `quartoDevCmd()`
(`tests/utils.ts:244`) returns `QUARTO_TEST_BIN` when set. These tests
already spawn a real binary; several (e.g. `stdlib-run-version`,
`lua-unit`) arguably *belong* in binary mode since they verify the shipped
`quarto run` stdlib/embedded deno.

**(c) Hardcoded `../package/dist/bin/quarto` spawns**
(`filters/editor-support`, `typst-gather` tests 7–12): consolidate onto the
patched `quartoDevCmd()`.

**(d) Semantic one-offs**: `env/check.test.ts` hardcodes `Version: 99.9.9`
(compute expectation from the binary, or relax the regex);
`inspect/inspect-standalone-rstudio.test.ts` uses the in-process
`_setIsRStudioForTest` hook (in binary mode, set `RSTUDIO=1` in the child
env instead — simpler than today; the companion "not RStudio" test requires
the harness to spawn with a *clean* env).

Implementation caveats surfaced by the sweep:
- `testQuartoCmd`'s `cwd` option must keep chdir-ing the **harness**
  process too (relative-path verifiers and teardowns depend on it), while
  also setting the subprocess cwd.
- Binary mode's `--log/--log-format` injection applies only to
  `testQuartoCmd`-driven invocations — never to tests that spawn quarto
  themselves and own their flags (`logging/log-level-and-formats` exists
  precisely to test those flags).

### 7.3 Genuinely dev-only (2 files)

`yaml-intelligence/yaml-intelligence.test.ts` and
`yaml-intelligence/yaml-intelligence-folded-block-strings.test.ts` —
`unitTest()` calls exercising `src/core/lib/yaml-intelligence` internals
with no CLI surface. **Recommendation: move them to `tests/unit/`** (the
other two files in `smoke/yaml-intelligence/` are ordinary render tests and
stay). With that move, *zero* smoke tests need `requiresDevQuarto` today;
the flag remains as an escape hatch for future tests.

**Reorganization verdict:** a folder/name convention (e.g. `smoke-dev/`,
`*.dev.test.ts`) is not worth it — dev-only-ness is too rare. Caution:
"uses `unitTest()`" is NOT a reliable dev-only signal (`run/*`,
`lua-unit`, `typst-gather` use it as a generic wrapper around subprocess
spawns). The reliable, greppable signals are: (a) `import ... from
".*src/quarto.ts"` in a test file, (b) spawns not routed through
`quartoDevCmd()`. Enforce both as lightweight lint/CI rules so new tests
stay binary-compatible by construction.

### 7.4 Smoke-all documents audit

The docs themselves are almost entirely binary-clean: no doc executes
quarto from a code cell, no runtime dev-tree paths, no pre/post-render
scripts in fixture `_quarto.yml`s, and **every `printsMessage` assertion
uses INFO/WARN/ERROR — never DEBUG** — matching a built binary's default
log level. The json-stream record shape from `--log <file> --log-format
json-stream` is identical to what `readExecuteOutput` parses, and
`--quiet` does not affect the file handler.

**One systemic blocker:** ten fixture extensions declare
`quarto-required: '>=99.9.0'`, which passes only against the dev sentinel
version — a real-version binary hard-errors in `validateExtension`
(`src/extension/extension.ts:776-788`). Affected fixtures: the
`dragonstyle/lipsum` copies under `dashboard/`, `lightbox/`,
`format/html/`, `2023/04/24/`; the brand/typst extension fixtures under
`typst/brand-yaml/typography/`, `typst/font-paths/`,
`brand/typography/remote-font-extension/`, `brand/logo/logo-extension*/`;
and `2023/01/06/input-relative/`. Two options:
- **Relax the fixtures to `'>=1.9'`** (preferred — keeps the binary's real
  version visible to everything else), unless a doc specifically tests
  version gating;
- or export `QUARTO_FORCE_VERSION=99.9.9` into the child env (honored at
  `src/core/quarto.ts:35`) — a blunter tool that masks real version
  behavior.

Driver adaptations beyond plain render: route the `editor-support-crossref`
pseudo-format (2 docs) and the 24 `render-project` pre-renders through the
binary; tolerate non-zero child exit (read the log file regardless — the
binary's top-level handler writes the ERROR record `shouldError` needs).
Runtime one-time checks: `engine/class-override` extensions
(`quarto-required '>=1.9.17'` — fails on older release binaries by design),
`QUARTO_EXECUTE_INFO` / `QUARTO_PROJECT_ROOT` env-var docs, and the
pandoc-args INFO echo docs (`2025/12/09/13775-*`).
