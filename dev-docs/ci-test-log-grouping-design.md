# Design: GitHub Actions log grouping and failure surfacing for the full (non-bucketed) test run

Status: **Phases 1–2 implemented** on this branch (Phase 1: annotations +
step summary, `tests/test.ts` + `src/tools/github.ts`; Phase 2: per-file
grouping, `tests/gha-grouping.ts` + the `tests/tools/check-gha-log.ts`
checker). Phase 3 remains optional/unscheduled. The fork `workflow_dispatch`
trial matrix (verification item 3) has not run yet.

Base: written on top of `test/smoke-tests-built-version` (the built-version
testing branch — see `llm-docs/built-version-testing-architecture.md`). The
non-bucketed full runs this design targets are exactly the runs that branch
adds: the smoke/playwright/ff-matrix legs of `test-smokes-built.yml` all call
`test-smokes.yml` with `buckets` empty (or a single-file bucket), landing in
the flat-log path described below. The design is mode-agnostic: in both dev
and binary mode the harness runs in the same `deno test` process, so marker
emission points are identical.

## Problem

PR [#13787](https://github.com/quarto-dev/quarto-cli/pull/13787) and
[#13807](https://github.com/quarto-dev/quarto-cli/pull/13807) made bucketed CI
runs navigable by wrapping each test file in a `::group::` at the **workflow
level** (`.github/workflows/test-smokes.yml`, the "Run Smoke Tests as a
bucket on Linux/Windows" per-file loops). That works because the YAML loop
runs `run-tests.sh <one file>` at a time, so group markers stay contiguous.

The **default path** — `buckets == ''`, the "Run all Smoke Tests
Linux/Windows" steps in `test-smokes.yml` — runs one giant `deno test` over
every discovered test file (in binary mode, `run-tests.sh` defaults this to
`smoke/`). No code on that path emits a single workflow command, so the log is
thousands of flat lines and finding a failure means scrolling or text search.
Every leg of `test-smokes-built.yml` (smoke, playwright, ff-matrix) reaches
this path.

Additional gaps that apply to *both* paths:

- No `::error` annotations per failed test → failures are not visible on the
  run summary page or PR checks tab (only the playwright integration test
  emits one today, in `tests/integration/playwright-tests.test.ts`).
- Nothing writes `GITHUB_STEP_SUMMARY` → no at-a-glance failure table.
- `src/tools/github.ts` already contains a complete, correctly-escaping
  workflow-command toolkit (`startGroup`/`endGroup`, `error`/`warning`/`notice`
  with `escapeData`/`escapeProperty`, `isGitHubActions()` gating) that is dead
  code for tests.

## Hard constraints (GitHub Actions runner behavior)

These drive the whole design; sources at the end.

1. **Groups cannot nest.** A second `::group::` acts as an implicit
   `::endgroup::` for the first; content after the inner group ends up
   *outside any group*. Still unfixed
   ([actions/toolkit#1001](https://github.com/actions/toolkit/issues/1001),
   [actions/runner#802](https://github.com/actions/runner/issues/802)).
   Consequence: **exactly one owner of grouping per code path**.
2. A stray `::endgroup::` with no open group is harmless — safe to emit
   defensively. (Shell caveat: `echo "::endgroup::"` clobbers `$?`; capture
   exit codes first. Not an issue in TypeScript.)
3. **Groups cannot be force-expanded** in the UI
   ([actions/runner#1036](https://github.com/actions/runner/issues/1036)).
   Failure detail must therefore land *outside* groups.
4. **Annotation caps**: 10 `::error` + 10 `::warning` per **step**, 50 total
   per **job**; excess silently dropped. Emit at most ~9 per-test error
   annotations per step, then one aggregate.
5. **`GITHUB_STEP_SUMMARY`**: 1 MiB per step, max 20 step summaries shown per
   job. Content just under the limit can be *silently* dropped
   ([actions/runner#4337](https://github.com/actions/runner/issues/4337)) —
   self-truncate around ~512 KiB.
6. Annotation messages do **not** render ANSI escapes — strip color codes
   before putting captured output into `::error` text or the step summary.
   ANSI *inside* group bodies is fine (the log viewer renders it).
7. Parsing is line-based on stdout: commands work from any child process, but
   must start at column 0 with a trailing newline. Multi-line messages use
   `%0A` escaping (`escapeData` in `src/tools/github.ts` already does this).
8. **Interleaved parallel output corrupts grouping** (process B's `::group::`
   implicitly closes process A's). Today this is a non-issue: `run-tests.sh`
   line 164 invokes `deno test` **without `--parallel`**, so test files run
   serially in one process. If `--parallel` is ever added, grouping must move
   to buffer-and-flush emission (see Non-goals).

## Spike results (verified with the pinned Deno v2.7.14)

A standalone experiment (two test files, markers emitted from inside
`Deno.test` bodies, one seeded failure) confirmed:

- Marker lines printed from a test body are replayed **verbatim at column 0**
  inside Deno's `------- output -------` / `------- post-test output -------`
  framing, so the runner parses them.
- Opening a group inside the *first test of a file* yields this net structure
  (as the runner parses it):

  ```text
  running N tests from ./smoke/foo.test.ts     <- visible (outside groups)
  [smoke] > first test name ...                <- visible
  ::group::./smoke/foo.test.ts                 <- group opens
     ...all per-test output and "... ok" lines of the file...
  ::endgroup::                                 <- emitted by THIS file's unload
  running M tests from ./smoke/bar.test.ts     <- visible
  ```

  i.e. per-file grouping collapses exactly the noise (per-test output blocks
  and `ok` lines) while keeping Deno's own file headers visible as structure.
- **Per-file module instances (correction, found via review #1986).** Deno
  instantiates each test file's module graph separately: module state resets
  between files, and each file gets its own `unload` event, flushed before
  the next file's header. The original spike misread the inter-file
  `::endgroup::` as the next file's first test closing the previous group
  via shared state — it is actually the previous file's own unload. The
  observable grouping output is identical either way (which is why the
  probes looked right), but it means module-level state is per-FILE: any
  genuinely per-step value (the annotation budget) must be coordinated
  through the filesystem, and the grouping state machine's cross-file
  transition close is in practice a no-op safety net (each instance only
  ever sees its own file).
- **On failure**, emitting `::endgroup::` from the failure path *before*
  throwing puts the `FAILED` result line **outside** any group (visible in the
  collapsed view), with the `::error` annotation adjacent. The next passing
  test simply re-opens a group with the same file title (flat sequential
  groups — allowed).
- Each file's `unload` `::endgroup::` flushes **before** the next file's
  header and before Deno's terminal `ERRORS` / `FAILURES` / summary
  sections, so file groups never bleed into the next file and the end-of-run
  failure details are never swallowed by the last group.

Caveat: the exact attribution of output to Deno's `output` vs `post-test
output` blocks is reporter behavior that may shift across Deno upgrades. It
does not affect correctness of the net grouping shown above, but the
verification checker (below) should run again on any Deno bump.

## Design

Three phases, each independently shippable and independently revertable.

### Phase 1 — failure surfacing (no grouping; zero nesting risk)

All changes in `tests/test.ts`, in the existing failure path that builds the
`━━━ TEST FAILURE:` block (around line 327), reusing `src/tools/github.ts`
helpers (gated on `isGitHubActions()`, so local runs are byte-identical):

1. **`::error` annotation per failed test**:
   `error(message, { file, title })` with
   - `file`: repo-relative path of the test file (or the smoke-all `.qmd`
     document when the failing test is a smoke-all doc — that is the file a
     developer needs to open);
   - `title`: the test name (`[smoke] > ...`);
   - message: the repro command (`./run-tests.sh <path>`) plus the first ~20
     lines of ANSI-stripped captured output, `%0A`-escaped.
   - **Cap and ownership**: GitHub's 10-errors cap is per *workflow step*,
     but bucket mode runs many `run-tests.sh` processes inside one step — a
     per-process counter cannot implement a per-step budget there, and the
     YAML bucket loop already emits its own `::error` per failed file.
     Resolution: **the harness emits annotations only when it owns the step**
     (`QUARTO_TESTS_GHA_ORCHESTRATED` unset — the default path). One
     `deno test` process is the whole step there, BUT a module-level counter
     is still NOT a step budget: Deno instantiates each test file's module
     graph separately (verified on the pinned 2.7.14 — module state resets
     per file and `unload` fires once per file), so the count is coordinated
     through a sidecar counter file derived from `GITHUB_STEP_SUMMARY`
     (unique per step, runner-writable; no locking needed — files run
     sequentially without `--parallel`). Stop at 9; the failure that crosses
     the cap emits the single aggregate `::error` inline as the step's 10th
     and last annotation (no cross-file end-of-run hook exists to emit it
     later).
     In bucket mode the YAML loop keeps its per-file `::error` as today.
     Known, accepted: if more than 10 bucket files fail, GitHub silently
     drops the excess YAML annotations too — the step summary (below) is the
     complete record in all modes; annotations are best-effort navigation.
2. **Step summary row per failed test**: append to the file at
   `$GITHUB_STEP_SUMMARY` (plain `Deno.writeTextFileSync(..., { append: true })`;
   add a small `stepSummary()` helper to `src/tools/github.ts`):
   - a table header once per test FILE (module state is per file — see the
     spike correction above), then one row per failure: test file / test
     name / duration. Per-failure `<details><summary>output</summary>`
     blocks (ANSI-stripped excerpt + repro command) are **buffered and
     flushed after that file's table at its per-file `unload` event** — GFM
     ends a table at the first non-row line, so detail blocks cannot
     interleave between rows. Each failing file therefore contributes its
     own small table followed by its detail blocks. Accepted consequence:
     on a hard process death (panic/OOM) pending unloads never fire and
     buffered details are lost — but every row was already appended at
     failure time, so the summary tables remain the complete record;
   - the size budget must also be per *step*, not per process (bucket mode:
     many processes append to the same summary file): before each append,
     `stat` the summary file and degrade to name-only rows once it exceeds
     ~512 KiB — the file size itself is the cross-process coordination, and
     staying at ~half the 1 MiB limit dodges the silent-drop bug.

Summary rows are emitted in **all** modes (cap-free, cross-process safe);
annotations follow the ownership rule above. Each bucket *job* still gets its
own summary page and annotation set.

### Phase 2 — per-file grouping for the default path (env-gated harness emission)

Owner rule: **the harness owns groups and annotations only when nothing else
does.**

- One env switch, `QUARTO_TESTS_GHA_ORCHESTRATED=1`, set by the two YAML
  bucket loops in `test-smokes.yml` alongside their existing
  `::group::Testing ${file}` — meaning "an outer orchestrator owns workflow
  commands for this step": the harness emits **no groups and no
  annotations** (step-summary rows are always emitted; they are cap-free and
  size-coordinate via the summary file, see Phase 1). The #13807 bucket log
  format does not change at all. Anyone else wrapping `run-tests.sh` in their
  own group can use the same switch.
- In `tests/test.ts`, a small module (or an extension of the existing
  `src/tools/github.ts` import) tracks the current test-file origin:
  - at the start of each test's `execute`, resolve the declaring file (the
    harness already knows it — `testQuartoCmd`/`unitTest` call sites — or via
    the registration call's captured stack);
  - on file change: `endGroup()` (defensive, harmless if none open) then
    `startGroup(relativePath)`. NOTE (spike correction): since each test
    file gets a fresh module instance, an instance in practice only ever
    sees its own file — the transition close is a safety net for a future
    Deno that shares module state again, not the working mechanism;
  - on the failure path (before `fail()` throws): `endGroup()` and clear the
    "open" flag, so the `FAILED` line and annotation land outside groups
    (verified by the spike). Any failure that escapes the harness's
    execute/verify path (init, prereq, setup, teardown — review #1991) must
    also close the group before propagating to Deno: an outer catch around
    the whole test body closes-and-rethrows, idempotently;
  - `globalThis.addEventListener("unload", ...)`: fires once per test FILE
    and closes that file's group — this is what actually ends a passing
    file's group before the next file's header, and keeps the terminal
    `ERRORS`/summary sections ungrouped (verified);
  - every emission gated on
    `isGitHubActions() && !Deno.env.get("QUARTO_TESTS_GHA_ORCHESTRATED")`.
- **Closure policy: per-file closure at the file's own `unload`** (plus the
  failure-path close). A pleasant consequence of per-file module instances:
  a direct `Deno.test` file (no harness registration) running between two
  harness files executes AFTER the previous file's unload closed its group —
  foreign tests' output and `FAILED` lines land ungrouped, visible. The
  stale-group swallowing originally accepted under "lazy closure" does not
  occur in practice; invariant 3 stays scoped to harness-registered tests
  only as a guard against Deno changing its module-instantiation model
  (which the checker script would catch).
- Granularity is **per test file**, matching Deno's own "running N tests
  from ..." structure. Per-test granularity is the documented fallback if real
  logs show files whose single collapsed group is still too coarse (e.g.
  `smoke-all.test.ts` runs many documents as separate tests — if needed, treat
  each smoke-all *document* as the boundary instead; the harness knows the
  document path).

### Phase 3 (optional follow-ups)

- Run-level footer in the step summary: pass/fail/skip counts and total
  duration (from an `unload` hook), so a green run also leaves a one-line
  receipt.
- Group the setup portions of the default-path steps in YAML (precedent: the
  R-setup steps already do this, `test-smokes.yml` lines 179–216).
- Add the final marker-emission conventions to `llm-docs/testing-patterns.md`
  so future automated changes preserve the invariants below.

## Invariants (must hold after any change)

1. At most one group open at any time per job step; every `::group::` is
   closed before the next one opens (defensive `endGroup()` first).
2. No `::group::`/`::endgroup::` and no harness `::error` emitted while an
   outer orchestrator owns the step (`QUARTO_TESTS_GHA_ORCHESTRATED`
   contract).
3. For **harness-registered** tests: `FAILED` result lines, the
   `ERRORS`/`FAILURES` sections, and the run summary are never inside a
   group. (Direct `Deno.test` files are formally exempt, though in practice
   per-file unload closure keeps them ungrouped too — see the closure policy
   in Phase 2 and "Coverage limitation".)
4. Per-test `::error` annotations only when the harness owns the step, and
   then ≤ 9 + 1 aggregate per step — enforced across per-file module
   instances via the sidecar counter file, NOT module state; ≤ 50
   annotations total per job including the YAML bucket loop's own. The step
   summary is the complete failure record in every mode.
5. Everything is a no-op unless `GITHUB_ACTIONS == "true"`: local output is
   byte-identical.
6. No change to which tests run, their order, or exit codes.
7. All interpolated text goes through `escapeData`/`escapeProperty`; ANSI is
   stripped from annotation messages and step-summary content.

## Verification plan

1. **Marker checker script** (`tests/tools/check-gha-log.ts` or similar,
   dev-only): reads a captured log and asserts invariants 1–3 mechanically
   (balanced groups, no nesting, markers at column 0, `FAILED`/`ERRORS` lines
   outside groups). Run it locally on
   `GITHUB_ACTIONS=true ./run-tests.sh <subset> | tee log.txt`. Re-run on every
   Deno version bump (reporter framing is version-sensitive).
   Windows capture gotcha: use `pwsh -File run-tests.ps1 <files>` with the
   redirect at the shell level — `pwsh -Command '... run-tests.ps1 <files>
   *> log'` feeds the `*>` into the script's own arg parsing, blanking the
   file arguments and silently running the full suite.
2. **Unit tests** for the new pure logic: annotation cap counter, the
   orchestrated-mode gate (no annotations/groups when
   `QUARTO_TESTS_GHA_ORCHESTRATED` is set), ANSI stripping, the stat-based
   summary size budget (including the degrade-to-name-only path), escaping.
3. **Trial CI runs** on a fork via `workflow_dispatch`, with one deliberately
   failing test committed temporarily, covering all four cells:
   {bucketed, default} × {Linux, Windows} — plus one bucket run with **more
   than 10 failing files**, to observe GitHub's silent annotation dropping
   and confirm the step summary still lists every failure. Check in the real
   UI:
   - groups collapse and titles read well; bucket-mode logs unchanged;
   - annotations appear on the run summary (and PR checks view when opened as
     a PR), pointing at the right file;
   - step summary table renders; truncation path exercised once by seeding
     many failures;
   - job still fails with the same exit semantics as before.
4. **Rollback safety**: Phase 1 and Phase 2 are separate commits; each is
   revertable without touching the other. `QUARTO_TESTS_GHA_ORCHESTRATED=1`
   in the environment is a global kill switch for harness grouping and
   annotations without a revert (summary rows remain).

## Coverage limitation: tests that bypass `tests/test.ts`

Phases 1–2 hook the harness (`testQuartoCmd`/`unitTest`/`test`), so they only
cover tests registered through it. Tests that call `Deno.test` directly get
neither groups nor failure annotations. Today that is chiefly the
extension-subtree tests copied into the tree by
`.github/actions/merge-extension-tests` (`smoke/julia-engine/*.test.ts` from
the `PumasAI/quarto-julia-engine` subtree — self-contained, `jsr:` imports
only, raw `Deno.Command("quarto")` spawns). Those spawns also leak the
harness dev env into the built quarto, so the merge action currently skips
them in binary mode entirely; the un-gating plan (upstream env
sanitization) is `dev-docs/ci-julia-engine-binary-mode-followup.md` — in
dev shards they still run, ungrouped.

Group placement for such files (updated after the per-file-instance
correction): each harness file's group is closed by that file's own `unload`
before the next file starts, so a non-harness file runs with NO group open —
its output and inline `FAILED` lines land ungrouped and visible. The
stale-group swallowing this section originally accepted does not occur under
the current Deno model; invariant 3's harness-only scoping remains as a
guard in case a future Deno shares module state across files again (the
checker script would flag it). Richer coverage (own groups + annotations)
requires adopting the markers upstream in the subtree repo — subtree files
must not be edited in quarto-cli; see `.claude/rules/extension-subtrees.md`.

## Non-goals / explicitly deferred

- **Nested visual hierarchy** (file ▸ test ▸ render step): impossible on the
  runner; fake it with title prefixes only if ever needed.
- **`deno test --parallel`**: out of scope; if adopted, grouping must switch
  to buffer-and-flush (capture each test's output, emit
  group+body+endgroup atomically) or move to matrix sharding.
- **`::stop-commands::` armoring** of rendered-document output: our tests
  render repo-controlled documents, so command injection via test output is
  not a current threat; revisit if tests ever render untrusted input (note it
  would also disable our own markers while active).
- **JUnit/structured reporters**: `deno test --reporter=junit` could feed a
  richer summary later, but Phase 1 gets equivalent value from data the
  harness already has, without changing the reporter everyone reads today.
- **Local parallel runs** (`run-parallel-tests.ts` local mode) interleave
  freely today; grouping there is meaningless (`GITHUB_ACTIONS` unset) and
  stays untouched.

## References

- Workflow commands: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands>
- Nesting: actions/toolkit#1001, actions/runner#802, actions/runner#1477
- Annotation limits: github/community discussions #26680, #68471
- Step summary limits: GitHub docs + actions/runner#4337
- Escaping rules: `@actions/core` `command.ts` (mirrored by
  `src/tools/github.ts` `escapeData`/`escapeProperty`)
- Prior art in this repo: PR #13787, PR #13807, `test-smokes.yml` bucket
  loops, R-setup grouping (`test-smokes.yml`, "Setup R packages" step)
- Built-version testing context: `llm-docs/built-version-testing-architecture.md`
  (the CI legs whose logs this design targets)
