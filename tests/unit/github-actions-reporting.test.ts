/*
 * github-actions-reporting.test.ts
 *
 * Tests for the GitHub Actions failure-surfacing helpers used by the test
 * harness (dev-docs/ci-test-log-grouping-design.md): the annotation
 * cap/aggregate counter and its step-wide ordinal, the orchestrated-mode
 * gate, ANSI stripping, the stat-based step-summary size budget (including
 * the degrade-to-name-only path), the failure labels, excerpt-signature
 * clustering, the trimmed annotation body, and workflow-command escaping of
 * hostile test names.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  annotationBody,
  AnnotationBudget,
  escapeData,
  escapeProperty,
  excerptSignature,
  failureLabel,
  harnessOwnsStep,
  kStepSummaryBudgetBytes,
  stepSummary,
  stepSummarySize,
  stripAnsi,
  summaryClusterBlock,
  summaryTableHeader,
  summaryTableRow,
  summaryTableRowNameOnly,
} from "../../src/tools/github.ts";

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget caps at 9 then aggregates once", async () => {
  // null counter path → instance-local state, never touches the real
  // per-step sidecar file (which exists when this suite runs on CI)
  const budget = new AnnotationBudget(9, null);
  const decisions = [];
  for (let i = 0; i < 12; i++) {
    decisions.push(budget.recordFailure());
  }
  // exactly 9 per-test annotations, leaving room for one aggregate under
  // GitHub's 10-per-step cap
  assertEquals(decisions.filter((d) => d.emitAnnotation).length, 9);
  assertEquals(decisions.slice(0, 9).every((d) => d.emitAnnotation), true);
  // the 10th failure — and only the 10th — emits the single aggregate
  assertEquals(decisions.map((d) => d.emitAggregate), [
    false, false, false, false, false, false, false, false, false,
    true, false, false,
  ]);
  // the ordinal counts every failure, uncapped
  assertEquals(decisions.map((d) => d.ordinal), [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget honors a custom cap", async () => {
  const budget = new AnnotationBudget(2, null);
  assertEquals(budget.recordFailure(), { ordinal: 1, emitAnnotation: true, emitAggregate: false });
  assertEquals(budget.recordFailure(), { ordinal: 2, emitAnnotation: true, emitAggregate: false });
  assertEquals(budget.recordFailure(), { ordinal: 3, emitAnnotation: false, emitAggregate: true });
  assertEquals(budget.recordFailure(), { ordinal: 4, emitAnnotation: false, emitAggregate: false });
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget is step-wide across module instances", async () => {
  // Deno instantiates each test file's module graph separately, so each file
  // gets its own AnnotationBudget instance; the sidecar counter file is what
  // makes the cap per-step. Two instances sharing one file must consume ONE
  // budget between them, and the ordinal must keep counting across instances.
  const counter = Deno.makeTempFileSync({ suffix: ".count" });
  Deno.removeSync(counter); // budget must cope with a not-yet-created file
  try {
    const fileA = new AnnotationBudget(3, counter);
    const fileB = new AnnotationBudget(3, counter);
    assertEquals(fileA.recordFailure(), { ordinal: 1, emitAnnotation: true, emitAggregate: false });
    assertEquals(fileA.recordFailure(), { ordinal: 2, emitAnnotation: true, emitAggregate: false });
    // a fresh instance (new "file") continues the same step-wide count
    assertEquals(fileB.recordFailure(), { ordinal: 3, emitAnnotation: true, emitAggregate: false });
    // cap crossed in instance B: exactly one aggregate, then silence — in
    // both instances — while the ordinal keeps climbing
    assertEquals(fileB.recordFailure(), { ordinal: 4, emitAnnotation: false, emitAggregate: true });
    assertEquals(fileA.recordFailure(), { ordinal: 5, emitAnnotation: false, emitAggregate: false });
    assertEquals(fileB.recordFailure(), { ordinal: 6, emitAnnotation: false, emitAggregate: false });
  } finally {
    try {
      Deno.removeSync(counter);
    } catch {
      // already gone
    }
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - failureLabel prefixes the ordinal with the runner OS", async () => {
  // RUNNER_OS is "Linux" / "Windows" / "macOS"; the prefix keeps the label a
  // stable ASCII token that is unambiguous across the run page's concatenated
  // per-job summaries (the label is the Ctrl+F navigation target).
  assertEquals(failureLabel(7, "Linux"), "L-F7");
  assertEquals(failureLabel(7, "Windows"), "W-F7");
  assertEquals(failureLabel(7, "macOS"), "M-F7");
  // unknown / empty runner → X
  assertEquals(failureLabel(1, ""), "X-F1");
  assertEquals(failureLabel(3, "FreeBSD"), "X-F3");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - excerptSignature is the first 3 non-empty ANSI-stripped lines", async () => {
  // blank lines are skipped, exactly three lines are taken, color codes gone;
  // line content (including indentation) is preserved so identical failures
  // produce byte-identical signatures.
  const excerpt = "\x1b[31mone\x1b[0m\n\n  two  \n\nthree\nfour\nfive";
  assertEquals(excerptSignature(excerpt), "one\n  two  \nthree");
  // fewer than three non-empty lines → all of them
  assertEquals(excerptSignature("only\n\n"), "only");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - identical-error excerpts share a signature; distinct ones don't", async () => {
  // this equality is exactly the clustering decision: same signature → same
  // Map key → one cluster; the first line alone is too generic, hence three.
  const a = "AssertionError: x\n  at foo\n  at bar\n  detail-a";
  const b = "AssertionError: x\n  at foo\n  at bar\n  detail-b"; // differs past line 3
  const c = "TypeError: y\n  at baz\n  at qux";
  assertEquals(excerptSignature(a), excerptSignature(b), "same first 3 lines cluster");
  assert(excerptSignature(a) !== excerptSignature(c), "different errors do not cluster");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody trims to repro + 5 lines + summary pointer", async () => {
  const excerpt = "l1\nl2\nl3\nl4\nl5\nl6\nl7";
  const body = annotationBody("./run-tests.sh x.qmd", excerpt, "L-F7");
  assert(body.startsWith("./run-tests.sh x.qmd\n\n"), "repro then a blank line");
  assert(body.includes("l1\nl2\nl3\nl4\nl5"), "first five excerpt lines kept");
  assert(!body.includes("l6"), "sixth line dropped");
  assert(body.includes("…"), "ellipsis marks the truncation");
  assert(
    body.trimEnd().endsWith("Full output: step summary → L-F7"),
    "pointer line carries the label",
  );
});

// deno-lint-ignore require-await
unitTest("gha-reporting - harnessOwnsStep gate", async () => {
  // owns the step: on CI with no orchestrator claiming it. null = "treat as
  // unset" — an explicit undefined would trigger the default parameter and
  // read the REAL env, which IS set inside CI bucket steps, flipping this
  // test's result depending on where it runs.
  assertEquals(harnessOwnsStep(true, null), true);
  assertEquals(harnessOwnsStep(true, ""), true);
  // an outer orchestrator owns the step
  assertEquals(harnessOwnsStep(true, "1"), false);
  // never emits off CI
  assertEquals(harnessOwnsStep(false, null), false);
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

    // no-op (does not throw) when the summary file is explicitly absent.
    // null is the sentinel; an explicit `undefined` would trigger the
    // default parameter and hit the REAL $GITHUB_STEP_SUMMARY on CI (the
    // bug this trial-run regression guards: cderv/quarto-cli run 29767179626)
    stepSummary("ignored", "");
    stepSummary("ignored", null);
    assertEquals(stepSummarySize(""), 0);
    assertEquals(stepSummarySize(null), 0);
  } finally {
    Deno.removeSync(tmp);
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - summary table carries a plain-text label column", async () => {
  // step-summary heading anchors do NOT resolve (verified: fork run
  // 29923715216), so the label is plain text in EVERY row — no `[..](#..)`
  // link syntax. Ctrl+F on the label still gives row ↔ detail navigation.
  const header = summaryTableHeader();
  assert(header.startsWith("| # | Test file | Test | Duration |"), "leading # column");

  const row = summaryTableRow("L-F7", "tests/docs/smoke-all/x.qmd", "a|b\nc <tag>", 1234);
  assert(row.startsWith("| L-F7 |"), "plain label in the # column");
  assert(!row.includes("](#"), "no fragment-link syntax");
  assert(row.includes("\\|"), "pipe escaped");
  assert(!row.includes("b\nc"), "newline collapsed");
  assert(row.includes("&lt;tag&gt;"), "angle brackets escaped");
  assert(row.includes("1.23s"), "duration formatted");

  // degraded row shares the same plain label rendering, empty duration cell
  const nameOnly = summaryTableRowNameOnly("L-F8", "tests/docs/smoke-all/x.qmd", "a|b");
  assert(nameOnly.startsWith("| L-F8 |"), "name-only row carries the label too");
  assert(nameOnly.includes("\\|"), "pipe escaped in name-only row");
  assert(nameOnly.trimEnd().endsWith("| |"), "empty duration cell");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - single-member cluster renders a labeled detail block", async () => {
  const block = summaryClusterBlock({
    label: "L-F3",
    members: [{
      label: "L-F3",
      file: "docs/smoke-all/x.qmd",
      testName: "[smoke] > quarto render docs/smoke-all/x.qmd <b>",
      repro: "./run-tests.sh docs/smoke-all/x.qmd",
    }],
    excerpt: "boom <script> & ``` end",
  });
  // the label-only heading precedes the block (the second Ctrl+F hit) and is
  // nothing but the label, so no arbitrary test name lands in a heading
  assert(block.includes("#### L-F3"), "label-only heading precedes the block");
  assert(
    block.includes("<summary><code>docs/smoke-all/x.qmd</code> — "),
    "summary label carries the test file",
  );
  assert(
    block.includes("[smoke] &gt; quarto render docs/smoke-all/x.qmd &lt;b&gt;"),
    "test name in label is HTML-escaped",
  );
  assert(!block.includes("tests)</summary>"), "no (N tests) count for a single member");
  assert(!block.includes("<summary>output</summary>"), "no anonymous label");
  assert(block.includes("<pre>"));
  assert(block.includes("&lt;script&gt;"), "angle brackets escaped");
  assert(block.includes("&amp;"), "ampersand escaped");
  assert(block.includes("./run-tests.sh docs/smoke-all/x.qmd"), "repro in the block body");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - multi-member cluster lists members and shares one excerpt", async () => {
  const block = summaryClusterBlock({
    label: "L-F3",
    members: [
      { label: "L-F3", file: "a.qmd", testName: "first", repro: "./run-tests.sh a.qmd" },
      { label: "L-F9", file: "b.qmd", testName: "second", repro: "./run-tests.sh b.qmd" },
    ],
    excerpt: "shared boom",
  });
  assert(block.includes("#### L-F3"), "cluster anchored on the first member's label");
  assert(block.includes("(2 tests)"), "member count in the summary label");
  assert(block.includes("L-F9"), "second member is listed");
  assert(
    block.includes("<code>b.qmd</code>") && block.includes("./run-tests.sh b.qmd"),
    "per-member file and repro in the list",
  );
  // ONE shared excerpt (the first member's), not one per member
  assertEquals(
    (block.match(/shared boom/g) || []).length,
    1,
    "excerpt appears exactly once",
  );
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
