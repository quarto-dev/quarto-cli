/*
 * github-actions-reporting.test.ts
 *
 * Tests for the GitHub Actions failure-surfacing helpers used by the test
 * harness (Phase 1 of dev-docs/ci-test-log-grouping-design.md): the
 * annotation cap/aggregate counter, the orchestrated-mode gate, ANSI
 * stripping, the stat-based step-summary size budget (including the
 * degrade-to-name-only path), and workflow-command escaping of hostile
 * test names.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  AnnotationBudget,
  escapeData,
  escapeProperty,
  harnessOwnsStep,
  kStepSummaryBudgetBytes,
  stepSummary,
  stepSummarySize,
  stripAnsi,
  summaryDetailBlock,
  summaryTableRow,
  summaryTableRowNameOnly,
} from "../../src/tools/github.ts";

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget caps at 9 then aggregates", async () => {
  const budget = new AnnotationBudget();
  const emitted: boolean[] = [];
  for (let i = 0; i < 12; i++) {
    emitted.push(budget.recordFailure());
  }
  // exactly 9 per-test annotations, leaving room for one aggregate under
  // GitHub's 10-per-step cap
  assertEquals(emitted.filter((x) => x).length, 9);
  assertEquals(emitted.slice(0, 9).every((x) => x), true);
  assertEquals(emitted.slice(9).some((x) => x), false);
  // the 3 failures past the cap are counted for the aggregate
  assertEquals(budget.suppressedCount(), 3);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget honors a custom cap", async () => {
  const budget = new AnnotationBudget(2);
  assertEquals(budget.recordFailure(), true);
  assertEquals(budget.recordFailure(), true);
  assertEquals(budget.recordFailure(), false);
  assertEquals(budget.suppressedCount(), 1);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - budget with no failures aggregates nothing", async () => {
  const budget = new AnnotationBudget();
  assertEquals(budget.suppressedCount(), 0);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - harnessOwnsStep gate", async () => {
  // owns the step: on CI with no orchestrator claiming it
  assertEquals(harnessOwnsStep(true, undefined), true);
  assertEquals(harnessOwnsStep(true, ""), true);
  // an outer orchestrator owns the step
  assertEquals(harnessOwnsStep(true, "1"), false);
  // never emits off CI
  assertEquals(harnessOwnsStep(false, undefined), false);
  assertEquals(harnessOwnsStep(false, "1"), false);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - stripAnsi removes color codes", async () => {
  assertEquals(stripAnsi("\x1b[31mred\x1b[0m"), "red");
  assertEquals(stripAnsi("\x1b[1m\x1b[32mbold green\x1b[0m done"), "bold green done");
  // plain text is untouched
  assertEquals(stripAnsi("no color here"), "no color here");
  // newlines are preserved (only escapes are stripped)
  assertEquals(stripAnsi("line1\n\x1b[31mline2\x1b[0m"), "line1\nline2");
});

unitTest("gha-reporting - step summary size budget and degrade path", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    // fresh file: size is 0, well under budget
    assertEquals(stepSummarySize(tmp), 0);

    // append accumulates and stat reflects the growth
    stepSummary("x".repeat(100), tmp);
    assertEquals(stepSummarySize(tmp), 100);
    assert(stepSummarySize(tmp) < kStepSummaryBudgetBytes, "still under budget");

    // push the file past the budget → the degrade decision flips
    stepSummary("y".repeat(kStepSummaryBudgetBytes), tmp);
    assert(
      stepSummarySize(tmp) > kStepSummaryBudgetBytes,
      "now over budget → callers degrade to name-only rows",
    );

    // no-op (does not throw) when the summary file is unset
    stepSummary("ignored", "");
    stepSummary("ignored", undefined);
    assertEquals(stepSummarySize(""), 0);
    assertEquals(stepSummarySize(undefined), 0);
  } finally {
    Deno.removeSync(tmp);
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - summary rows escape table-breaking characters", async () => {
  // pipes are escaped, newlines collapsed, angle brackets HTML-escaped so a
  // hostile test name cannot break the markdown table
  const row = summaryTableRow(
    "tests/docs/smoke-all/x.qmd",
    "a|b\nc <tag>",
    1234,
  );
  assert(row.includes("\\|"), "pipe escaped");
  assert(!row.includes("\n c") && !row.includes("b\nc"), "newline collapsed");
  assert(row.includes("&lt;tag&gt;"), "angle brackets escaped");
  assert(row.includes("1.23s"), "duration formatted");

  // degraded row records the failure by name with an empty duration cell
  const nameOnly = summaryTableRowNameOnly("tests/docs/smoke-all/x.qmd", "a|b");
  assert(nameOnly.includes("\\|"), "pipe escaped in name-only row");
  assert(nameOnly.trimEnd().endsWith("| |"), "empty duration cell");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - detail block escapes HTML so output cannot break out", async () => {
  const block = summaryDetailBlock(
    "./run-tests.sh docs/smoke-all/x.qmd",
    "boom <script> & ``` end",
  );
  assert(block.includes("<details><summary>output</summary>"));
  assert(block.includes("<pre>"));
  assert(block.includes("&lt;script&gt;"), "angle brackets escaped");
  assert(block.includes("&amp;"), "ampersand escaped");
  // the repro command is included in the block body
  assert(block.includes("./run-tests.sh docs/smoke-all/x.qmd"));
});

// deno-lint-ignore require-await
unitTest("gha-reporting - escaping of hostile test names", async () => {
  // escapeData (annotation message): %, CR, LF
  assertEquals(escapeData("a%b\nc\rd"), "a%25b%0Ac%0Dd");
  // escapeProperty (file=/title=): additionally : and ,
  assertEquals(escapeProperty("a%b:c,d\ne"), "a%25b%3Ac%2Cd%0Ae");
  // a name with :: (which would otherwise be read as a command terminator)
  assert(escapeProperty("[smoke] > weird::name").includes("%3A%3A"));
  // % is escaped first, so an existing %25 is not double-decoded
  assertEquals(escapeProperty("100%,done"), "100%25%2Cdone");
});
