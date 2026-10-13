---
main_commit: e5850df75
analyzed_date: 2026-09-15
key_files:
  - .github/workflows/test-smokes.yml
  - .github/workflows/test-smokes-parallel.yml
  - .github/workflows/test-ff-matrix.yml
  - src/tools/github.ts
  - tests/test.ts
  - tests/gha-grouping.ts
  - tests/integration/playwright-tests.test.ts
  - tests/tools/check-gha-log.ts
---

# GitHub Actions test reporting

Quarto's test harness groups full-run logs by test file and reports failures
through annotations and the GitHub Actions step summary. Bucketed workflows
already group each bucket and emit bucket-level annotations in their shell
loops, so the harness must not emit competing workflow commands.

## Ownership

There are two execution paths:

- **Harness-owned:** `QUARTO_TESTS_GHA_ORCHESTRATED` is unset. The harness
  emits groups, annotations, and step-summary entries. This does not imply a
  single `deno test` process: `run-tests.sh`'s timing mode (`QUARTO_TEST_TIMING`,
  used by `test-smokes.yml`) invokes separate `deno test` processes for test
  files, and invokes `smoke-all.test.ts` separately for each smoke-all document.
  It leaves the flag unset, so each invocation is independently harness-owned.
- **Orchestrated:** A workflow loop invokes `run-tests` once per file (or
  bucket of files) and sets `QUARTO_TESTS_GHA_ORCHESTRATED=1`. The loop owns
  groups and bucket-level annotations; the harness emits only step-summary
  entries. A direct test runner can still emit its own file-specific
  annotations.

`harnessOwnsStep()` in `src/tools/github.ts` implements this distinction.
Workflow commands are otherwise gated by `GITHUB_ACTIONS`.

Step-summary entries are emitted in both paths. A bucketed step can contain many
harness processes, all appending to the same summary file.

## Log grouping

GitHub Actions groups cannot nest. Starting a group while another is open
implicitly closes the first, and the later `::endgroup::` leaves subsequent
output ungrouped. Each execution path must therefore have one group owner.

For harness-owned runs:

1. The first `test()` registration in a file opens the group before Deno prints
   that file's reporter header. The file URL is recovered from the V8 call
   stack.
2. The test body opens or corrects the group from `context.origin`, which is
   authoritative. This is also the fallback when stack parsing fails.
3. A failure closes the group before teardown, annotation output, and Deno's
   `FAILED` line.
4. The file's `unload` handler closes a passing file's group before Deno prints
   the next file or the final `ERRORS` and `FAILURES` sections.

Deno creates a separate module graph for each test file and fires `unload` once
per file. Module-level grouping and summary state is therefore per file, not per
`deno test` process.

Workflow command markers must start at column 0 and end with a newline. ANSI
color is valid in group bodies but must be removed from annotations and step
summaries.

## Failure reporting

`tests/test.ts` reports each harness failure once, after cleanup and teardown.
When a primary test failure and a teardown or cleanup failure both occur, the
report includes both while preserving the primary exception.

Each failure contributes:

- A summary table row with a short navigation label, file, test name, and
  duration.
- A clustered detail block containing the reproduction command and a bounded
  output excerpt.
- A `::error` annotation when the harness owns the step and the annotation
  budget allows it.

Rows are written immediately. Detail blocks are buffered until the file's
`unload` event because GitHub-flavored Markdown ends a table at the first
non-row line. Failures with the same first three non-empty excerpt lines share
one detail block. The block renders only the first member's excerpt and says
so, because later lines (for `noErrorsOrWarnings`, the stack and any further
messages) can differ; the step log stays the complete record. `pendingClusters` is a module-level map, and Deno gives each
test-file execution its own module graph, so this clustering only merges
failures within one module instance, not across the step.

Summary writes are best-effort and limited to 512 KiB, leaving margin below
GitHub's 1 MiB per-step limit. Full rows degrade to name-only rows when
necessary. If no candidate fits, the harness emits one truncation notice and
leaves the complete failure record in the step log. Individual excerpts are also
byte-limited so one long line cannot consume the summary budget.

## Annotation budget and labels

GitHub displays at most 10 error annotations per step. The harness emits nine
per-test annotations, then one aggregate annotation when the tenth failure is
recorded.

The count must span test-file module instances. `AnnotationBudget` stores it in
a sidecar file derived from `GITHUB_STEP_SUMMARY`, which is unique to the step
and writable by the runner. Tests run serially, so no locking is needed. If the
sidecar cannot be read or written, reporting remains best-effort and falls back
to local counting.

Failure labels combine:

- `RUNNER_OS`, reduced to `L`, `W`, `M`, or `X`;
- `QUARTO_TESTS_GHA_LABEL_TAG`, supplied by the reusable-workflow caller;
- the step-wide failure ordinal.

The run summary concatenates summaries from multiple jobs. Every reusable
workflow call that can share an OS with another call in the same run must
therefore pass a distinct `label-tag`. Per-OS jobs may share a tag because the
OS prefix already distinguishes them.

## Workflow contract

When editing the smoke workflows:

- Set `QUARTO_TESTS_GHA_ORCHESTRATED=1` on loops that emit their own `::group::`
  or `::error` commands.
- Pass `label-tag` at every `test-smokes.yml` and `test-ff-matrix.yml` call
  site.
- Keep tags short and alphanumeric. `failureLabel()` discards other characters
  and keeps at most eight.
- Do not add `deno test --parallel`; interleaved workflow commands would corrupt
  grouping. Parallel support would require buffered, atomic output.

## Verification

Unit coverage is in:

- `tests/unit/gha-grouping.test.ts`
- `tests/unit/github-actions-reporting.test.ts`
- `tests/unit/harness-failure-reporting.test.ts`
- `tests/unit/check-gha-log.test.ts`

`tests/tools/check-gha-log.ts` validates captured logs for balanced, non-nested
groups, column-zero markers, and failure sections outside groups. Run it after
changing the grouping logic or upgrading Deno:

```bash
GITHUB_ACTIONS=true ./run-tests.sh <subset> | tee log.txt
deno run --allow-read tests/tools/check-gha-log.ts log.txt
```

Direct `Deno.test` files that bypass the Quarto harness (e.g.
`playwright-tests.test.ts`) receive none of the harness's own grouping,
annotation, or summary logic. They can still use file-specific reporting or be
wrapped by workflow-level reporting. On GitHub Actions,
`tests/integration/playwright-tests.test.ts` emits its own annotations; when a
bucket loop owns the step, it calls `gha.error` directly instead of using the
step-wide annotation budget. Bucket loops in `test-smokes.yml` also wrap each
bucket in their own `::group::`/`::endgroup::` pair and emit a bucket-level
failure annotation regardless of which files the bucket runs.
