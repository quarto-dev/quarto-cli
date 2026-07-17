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

Most `tests/smoke/**/*.test.ts` are pure `testQuartoCmd` and will just work.
A minority poke internals (unit tests, tests importing quarto APIs to compute
expectations, `quarto run` TS scripts relying on dev Deno, env-var tests).
Mechanism:

- Add `TestContext.requiresDevQuarto?: boolean`; the `test()` wrapper sets
  Deno's `ignore` when binary mode is active.
- Unit tests (`tests/unit/`) are dev-only by definition — excluded wholesale
  in binary mode.
- Start by targeting only **smoke-all + feature-format matrix** (bucket
  invocation), where this problem is near-zero, and grow coverage from there.

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
