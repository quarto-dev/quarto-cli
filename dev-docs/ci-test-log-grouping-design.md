# Design: GitHub Actions log grouping and failure surfacing for the full (non-bucketed) test run

Status: **proposal** (not implemented). This document plans the work; it
deliberately ships no behavior change.

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
  ::endgroup::                                 <- emitted by the next file's first test
  running M tests from ./smoke/bar.test.ts     <- visible
  ```

  i.e. per-file grouping collapses exactly the noise (per-test output blocks
  and `ok` lines) while keeping Deno's own file headers visible as structure.
- **On failure**, emitting `::endgroup::` from the failure path *before*
  throwing puts the `FAILED` result line **outside** any group (visible in the
  collapsed view), with the `::error` annotation adjacent. The next passing
  test simply re-opens a group with the same file title (flat sequential
  groups — allowed).
- An `unload` listener's `::endgroup::` flushes **before** Deno's terminal
  `ERRORS` / `FAILURES` / summary sections, so the end-of-run failure details
  are never swallowed by the last group.

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
   - **Cap**: a module-level counter stops at 9 annotations; the 10th failure
     emits a single aggregate
     `::error title=More test failures::N additional failures — see step summary`.
2. **Step summary row per failed test**: append to the file at
   `$GITHUB_STEP_SUMMARY` (plain `Deno.writeTextFileSync(..., { append: true })`;
   add a small `stepSummary()` helper to `src/tools/github.ts`):
   - a table header once per process (guard with a module flag), then one row
     per failure: test file / test name / duration, followed by a
     `<details><summary>output</summary>` block with the ANSI-stripped log
     excerpt and the repro command;
   - a byte budget (~512 KiB per process) after which rows degrade to
     name-only lines, to stay clear of the silent-drop bug.

This works identically in bucket mode and default mode (each bucket job gets
its own annotations and summary), and interacts with nothing that exists.

### Phase 2 — per-file grouping for the default path (env-gated harness emission)

Owner rule: **the harness owns grouping only when nothing else does.**

- New env switch `QUARTO_TESTS_NO_LOG_GROUP`. The two YAML bucket loops in
  `test-smokes.yml` set it (`=1`) alongside their existing
  `::group::Testing ${file}` — the #13807 bucket log format does not change at
  all. Anyone else wrapping `run-tests.sh` in their own group can use the same
  switch.
- In `tests/test.ts`, a small module (or an extension of the existing
  `src/tools/github.ts` import) tracks the current test-file origin:
  - at the start of each test's `execute`, resolve the declaring file (the
    harness already knows it — `testQuartoCmd`/`unitTest` call sites — or via
    the registration call's captured stack);
  - on file change: `endGroup()` (defensive, harmless if none open) then
    `startGroup(relativePath)`;
  - on the failure path (before `fail()` throws): `endGroup()` and clear the
    "open" flag, so the `FAILED` line and annotation land outside groups
    (verified by the spike);
  - `globalThis.addEventListener("unload", ...)`: close any open group so the
    terminal `ERRORS`/summary sections are never grouped (verified);
  - every emission gated on
    `isGitHubActions() && !Deno.env.get("QUARTO_TESTS_NO_LOG_GROUP")`.
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
2. No `::group::`/`::endgroup::` emitted while an outer YAML group is open
   (`QUARTO_TESTS_NO_LOG_GROUP` contract).
3. `FAILED` result lines, the `ERRORS`/`FAILURES` sections, and the run
   summary are never inside a group.
4. ≤ 9 per-test `::error` annotations per step + 1 aggregate; ≤ 50 total per
   job.
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
2. **Unit tests** for the new pure logic: annotation cap counter, ANSI
   stripping, summary byte budget/truncation, escaping.
3. **Trial CI runs** on a fork via `workflow_dispatch`, with one deliberately
   failing test committed temporarily, covering all four cells:
   {bucketed, default} × {Linux, Windows}. Check in the real UI:
   - groups collapse and titles read well; bucket-mode logs unchanged;
   - annotations appear on the run summary (and PR checks view when opened as
     a PR), pointing at the right file;
   - step summary table renders; truncation path exercised once by seeding
     many failures;
   - job still fails with the same exit semantics as before.
4. **Rollback safety**: Phase 1 and Phase 2 are separate commits; each is
   revertable without touching the other. `QUARTO_TESTS_NO_LOG_GROUP=1` in the
   environment is a global kill switch for grouping without a revert.

## Coverage limitation: tests that bypass `tests/test.ts`

Phases 1–2 hook the harness (`testQuartoCmd`/`unitTest`/`test`), so they only
cover tests registered through it. Tests that call `Deno.test` directly get
neither groups nor failure annotations. Today that is chiefly the
extension-subtree tests copied into the tree by
`.github/actions/merge-extension-tests` (`smoke/julia-engine/*.test.ts` from
the `PumasAI/quarto-julia-engine` subtree — self-contained, `jsr:` imports
only, raw `Deno.Command("quarto")` spawns).

Known wrinkle of the lazy per-file closure: the harness only closes a group
when its *next* test starts (or at `unload`), so a non-harness file running
between two harness files executes while the previous file's group is still
open — its output, including inline `FAILED` lines, is swallowed into that
stale group under a misleading title. Acceptable because Deno's end-of-run
`ERRORS`/`FAILURES` sections always repeat the full failure detail outside
any group (spike-verified), so such failures remain findable; but the doc'd
alternative if this bites is eager closure (end each group when the test that
opened it ends — safe against foreign tests, at the cost of one collapsed
block per test instead of per file). Richer coverage (own groups +
annotations) requires adopting the markers upstream in the subtree repo —
subtree files must not be edited in quarto-cli; see
`.claude/rules/extension-subtrees.md`.

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
