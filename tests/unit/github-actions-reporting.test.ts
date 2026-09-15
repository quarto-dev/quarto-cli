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
import { join } from "../../src/deno_ral/path.ts";
import {
  annotationBody,
  AnnotationBudget,
  appendStepSummaryBounded,
  appendStepSummaryFirstFit,
  escapeData,
  escapeProperty,
  excerptSignature,
  failureLabel,
  harnessOwnsStep,
  kExcerptMaxBytes,
  kStepSummaryBudgetBytes,
  kStepSummaryTruncationNotice,
  stepSummary,
  stepSummarySize,
  stripAnsi,
  summaryClusterBlock,
  summaryTableHeader,
  summaryTableRow,
  summaryTableRowNameOnly,
  truncateUtf8Bytes,
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
  // stable ASCII token. This is the no-tag shape: it separates the OS
  // sections of the run page's concatenated per-job summaries but NOT two
  // jobs on the same OS — that is what the workflow tag below is for.
  assertEquals(failureLabel(7, "Linux"), "L-F7");
  assertEquals(failureLabel(7, "Windows"), "W-F7");
  assertEquals(failureLabel(7, "macOS"), "M-F7");
  // unknown / empty runner → X
  assertEquals(failureLabel(1, ""), "X-F1");
  assertEquals(failureLabel(3, "FreeBSD"), "X-F3");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - failureLabel discriminates same-OS jobs by workflow tag", async () => {
  // ~20 bucket legs run on ubuntu in ONE run and every one of them starts its
  // step-wide ordinal at 1, so the OS prefix alone repeats `L-F1` all over the
  // run page. No ambient env var is unique per matrix leg (GITHUB_JOB is the
  // YAML job key, GITHUB_RUN_ID is run-wide), so the workflow injects the tag.
  assertEquals(failureLabel(1, "Linux", "b01"), "Lb01-F1");
  assertEquals(failureLabel(1, "Linux", "b02"), "Lb02-F1");
  assert(
    failureLabel(1, "Linux", "b01") !== failureLabel(1, "Linux", "b02"),
    "same OS, same ordinal, different leg → different label",
  );
  assertEquals(failureLabel(12, "Windows", "relsmk"), "Wrelsmk-F12");
  assertEquals(failureLabel(3, "macOS", "ngtsmk"), "Mngtsmk-F3");
  // the `-F` stays the boundary between job identity and ordinal
  assertEquals(failureLabel(7, "Linux", "b07"), "Lb07-F7");
  // unset input → the OS-only shape, which is NOT unique across same-OS jobs
  assertEquals(failureLabel(7, "Linux", ""), "L-F7");
  assertEquals(failureLabel(7, "Linux"), "L-F7");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - failureLabel sanitizes the workflow tag", async () => {
  // the label lands in a markdown table cell, a `####` heading and an
  // annotation title — three different escaping regimes — so anything outside
  // [A-Za-z0-9] is dropped rather than escaped, and the result is capped so
  // the Ctrl+F token stays short enough to lead every row.
  assertEquals(failureLabel(2, "Linux", "smoke | tests"), "Lsmoketes-F2");
  assertEquals(failureLabel(2, "Linux", "a*b_c-d"), "Labcd-F2");
  assertEquals(failureLabel(2, "Linux", "line\nbreak"), "Llinebrea-F2");
  // capped at 8 characters
  assertEquals(failureLabel(2, "Linux", "0123456789"), "L01234567-F2");
  // nothing usable left → the no-tag shape
  assertEquals(failureLabel(2, "Linux", "***"), "L-F2");
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
  const body = annotationBody("./run-tests.sh x.qmd", excerpt, "L-F7", "detail");
  assert(body.startsWith("./run-tests.sh x.qmd\n\n"), "repro then a blank line");
  assert(body.includes("l1\nl2\nl3\nl4\nl5"), "first five excerpt lines kept");
  assert(!body.includes("l6"), "sixth line dropped");
  assert(body.includes("…"), "ellipsis marks the truncation");
  assert(body.trimEnd().includes("L-F7"), "pointer line carries the label");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody pointer: a queued cluster gets honest, unconditional wording", async () => {
  // outcome="detail" means a cluster WAS queued at emit time, but whether it
  // survives the end-of-file flush is not knowable here (a later file's
  // content could still exhaust the shared budget first) — so the wording
  // must not promise the detail block exists, only that the row does.
  const body = annotationBody("./run-tests.sh x.qmd", "boom", "L-F7", "detail");
  assert(body.includes("L-F7"), "pointer carries the label");
  assert(!body.includes("Full output"), "does not promise complete output exists");
  assert(body.includes("step log"), "points the reader at the step log");
  assert(
    !body.includes("…"),
    "a short excerpt that fit under maxLines was not truncated, so no ellipsis is warranted",
  );
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody pointer: a degraded (name-only) row gets a distinct, accurate wording", async () => {
  // outcome="name-only" means the row itself was degraded to name-only (over
  // budget) and no cluster was queued — known synchronously, so this
  // pointer can accurately say no detail block exists.
  const body = annotationBody("./run-tests.sh x.qmd", "boom", "L-F8", "name-only");
  assert(body.includes("L-F8"));
  assert(!body.includes("Full output"), "no promise that a detail block exists");
  assert(body.includes("step log"), "points the reader at the step log");
  assert(
    body !== annotationBody("./run-tests.sh x.qmd", "boom", "L-F8", "detail"),
    "the two cases produce different wording",
  );
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody pointer: no row at all gets wording that names no summary target", async () => {
  // outcome="none" means neither the full row nor the name-only row fit —
  // nothing was recorded under this label in the step summary at all. The
  // pointer must not claim a row (of either kind) exists, and must not even
  // name the label as a summary target; it can only point at the step log.
  // The label still appears in the annotation title, so it is not lost.
  const body = annotationBody("./run-tests.sh x.qmd", "boom", "L-F9", "none");
  assert(!body.includes("L-F9"), "does not point the reader at a summary row under this label");
  assert(!body.includes("Failure row"), "does not claim any row exists");
  assert(!body.includes("Full output"), "does not promise complete output exists");
  assert(body.includes("step log"), "points the reader at the step log");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody produces three distinct bodies for the three outcomes", async () => {
  const bodies = (["detail", "name-only", "none"] as const).map((outcome) =>
    annotationBody("./run-tests.sh x.qmd", "boom", "L-F10", outcome)
  );
  assertEquals(new Set(bodies).size, 3, "each outcome has its own wording");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - annotationBody bounds a huge excerpt by bytes even if the caller didn't", async () => {
  const huge = "z".repeat(300 * 1024);
  const body = annotationBody("./run-tests.sh x.qmd", huge, "L-F9", "detail");
  assert(!body.includes(huge), "the full huge excerpt is not embedded whole");
});

// The byte-cap helper itself is new code with no pre-existing failure to
// capture as RED — contract tests only, not RED/GREEN.

// deno-lint-ignore require-await
unitTest("gha-reporting - truncateUtf8Bytes leaves content under the cap untouched", async () => {
  assertEquals(truncateUtf8Bytes("short", 100), "short");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - truncateUtf8Bytes bounds a huge single line by UTF-8 bytes", async () => {
  const huge = "z".repeat(1000);
  const truncated = truncateUtf8Bytes(huge, 100);
  assert(
    new TextEncoder().encode(truncated).length <= 100,
    "result stays within the byte budget",
  );
  assert(truncated.includes("truncated"), "marks that truncation happened");
  assert(truncated.length < huge.length, "shorter than the input");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - truncateUtf8Bytes cuts on a UTF-8 boundary, not mid-codepoint", async () => {
  // "€" is 3 bytes in UTF-8; a naive byte slice could split one in half and
  // leave an unpaired continuation byte, which TextDecoder replaces with
  // U+FFFD unless the cut point is chosen so it never lands there.
  // maxBytes must exceed the marker's own byte length (15) so this exercises
  // splitting the CONTENT, not the below-marker-length short-circuit path
  // (see the "budget below the marker length" tests below); 25 leaves a
  // 10-byte content budget, not a multiple of 3, so it still forces a split.
  const s = "€".repeat(50);
  const truncated = truncateUtf8Bytes(s, 25);
  assert(
    !truncated.includes("�"),
    "no replacement character from a split code point",
  );
});

// deno-lint-ignore require-await
unitTest("gha-reporting - truncateUtf8Bytes bounds the marker itself when maxBytes is below the marker's own length", async () => {
  // No production caller passes a budget this small — every real call site
  // uses a multi-KB constant — but the contract ("at most maxBytes bytes")
  // must hold unconditionally, including here: without a dedicated
  // short-circuit, the byte budget for content clamps to 0 and the FULL
  // marker (~15 bytes) is returned regardless of maxBytes.
  for (const maxBytes of [0, 1, 5, 10, 14]) {
    const truncated = truncateUtf8Bytes("z".repeat(1000), maxBytes);
    assert(
      new TextEncoder().encode(truncated).length <= maxBytes,
      `maxBytes=${maxBytes}: result must not exceed the requested budget`,
    );
  }
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

// appendStepSummaryBounded is new code with no pre-existing failure to
// capture as RED — contract tests only, not RED/GREEN.

unitTest("gha-reporting - appendStepSummaryBounded writes when content fits and reports success", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    assertEquals(appendStepSummaryBounded("| row |\n", tmp), true);
    assertEquals(Deno.readTextFileSync(tmp), "| row |\n");
  } finally {
    Deno.removeSync(tmp);
  }
});

unitTest("gha-reporting - appendStepSummaryBounded refuses content that would exceed the budget, and reports failure", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    Deno.writeTextFileSync(tmp, "x".repeat(kStepSummaryBudgetBytes));
    assertEquals(appendStepSummaryBounded("more content", tmp), false);
  } finally {
    Deno.removeSync(tmp);
  }
});

unitTest("gha-reporting - appendStepSummaryBounded emits the truncation notice exactly once, even across repeated refusals", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    // Close enough to the budget that ordinary content is refused but there
    // is still room reserved for the notice itself (the reservation is
    // exactly the notice's own byte length, so leave a bit more slack than
    // that for the arithmetic below).
    const noticeBytes = new TextEncoder().encode(kStepSummaryTruncationNotice)
      .length;
    Deno.writeTextFileSync(
      tmp,
      "x".repeat(kStepSummaryBudgetBytes - noticeBytes - 500),
    );
    assertEquals(appendStepSummaryBounded("y".repeat(1000), tmp), false);
    const afterFirst = Deno.readTextFileSync(tmp);
    assert(
      afterFirst.includes(kStepSummaryTruncationNotice),
      "the notice was written on the first refusal",
    );
    // Further refusals must not duplicate the notice.
    assertEquals(appendStepSummaryBounded("z".repeat(1000), tmp), false);
    assertEquals(appendStepSummaryBounded("w".repeat(1000), tmp), false);
    const afterMore = Deno.readTextFileSync(tmp);
    const occurrences = afterMore.split(kStepSummaryTruncationNotice).length - 1;
    assertEquals(occurrences, 1, "the notice is emitted exactly once");
  } finally {
    Deno.removeSync(tmp);
  }
});

unitTest("gha-reporting - appendStepSummaryBounded never lets the file exceed the configured limit", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    for (let i = 0; i < 50; i++) {
      appendStepSummaryBounded("z".repeat(20 * 1024) + "\n", tmp);
    }
    assert(
      stepSummarySize(tmp) <= kStepSummaryBudgetBytes,
      "size never exceeds the budget regardless of how many writes are attempted",
    );
  } finally {
    Deno.removeSync(tmp);
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - appendStepSummaryBounded no-ops when the path is unset", async () => {
  assertEquals(appendStepSummaryBounded("ignored", null), false);
  assertEquals(appendStepSummaryBounded("ignored", ""), false);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - appendStepSummaryBounded reports failure when the write itself fails, not just when the budget check refuses", async () => {
  // A small candidate can pass the size-budget check (stepSummarySize reads
  // 0 on an unreadable path) and then fail the actual write. The return
  // value must reflect the write, or a caller mistakes a lost row for a
  // recorded one.
  const dir = Deno.makeTempDirSync({ prefix: "quarto-summary" });
  try {
    const unwritable = join(dir, "no-such-dir", "summary.md");
    assertEquals(appendStepSummaryBounded("| row |\n", unwritable), false);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

// appendStepSummaryFirstFit exists because trying a full-size candidate and
// emitting the truncation notice on refusal (as appendStepSummaryBounded
// does) consumes the notice's reserved headroom before a smaller fallback
// candidate gets its turn — so a fallback that would have fit BEFORE the
// notice was written can be refused AFTER it.

unitTest("gha-reporting - appendStepSummaryFirstFit writes a smaller fallback that the notice would otherwise crowd out", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    const fullRow = summaryTableRow("L-F1", "tests/x.qmd", "some test", 100);
    const nameOnlyRow = summaryTableRowNameOnly(
      "L-F1",
      "tests/x.qmd",
      "some test",
    );
    const byteLen = (s: string) => new TextEncoder().encode(s).length;
    const noticeBytes = byteLen(kStepSummaryTruncationNotice);
    const contentBudget = kStepSummaryBudgetBytes - noticeBytes;
    // Sized so the full row is refused but the name-only row still fits:
    // size + nameOnlyBytes == contentBudget (fits), and since fullRow is
    // strictly longer than nameOnlyRow, size + fullBytes > contentBudget.
    const size = contentBudget - byteLen(nameOnlyRow);
    Deno.writeTextFileSync(tmp, "x".repeat(size));

    const index = appendStepSummaryFirstFit([fullRow, nameOnlyRow], tmp);
    assertEquals(index, 1, "the second (smaller) candidate was written");
    const content = Deno.readTextFileSync(tmp);
    assert(
      content.includes(nameOnlyRow),
      "the name-only row fit before the notice and must survive",
    );
    assert(
      content.includes(kStepSummaryTruncationNotice),
      "the notice is still emitted, since the preferred candidate was dropped",
    );
  } finally {
    Deno.removeSync(tmp);
  }
});

unitTest("gha-reporting - appendStepSummaryFirstFit returns 0 and emits no notice when the first candidate fits", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    const index = appendStepSummaryFirstFit(["small", "smaller"], tmp);
    assertEquals(index, 0);
    const content = Deno.readTextFileSync(tmp);
    assertEquals(content, "small");
    assert(!content.includes(kStepSummaryTruncationNotice));
  } finally {
    Deno.removeSync(tmp);
  }
});

unitTest("gha-reporting - appendStepSummaryFirstFit returns -1 and emits the notice when nothing fits", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    // Fill exactly to the content budget (budget minus the notice's own
    // reserved headroom): any nonzero candidate is refused, but there is
    // still exactly enough room left for the notice itself.
    const noticeBytes = new TextEncoder().encode(kStepSummaryTruncationNotice)
      .length;
    Deno.writeTextFileSync(
      tmp,
      "x".repeat(kStepSummaryBudgetBytes - noticeBytes),
    );
    const index = appendStepSummaryFirstFit(
      ["CANDIDATE_ONE_PAYLOAD", "CANDIDATE_TWO_PAYLOAD"],
      tmp,
    );
    assertEquals(index, -1);
    const content = Deno.readTextFileSync(tmp);
    assert(content.includes(kStepSummaryTruncationNotice));
    assert(
      !content.includes("CANDIDATE_ONE_PAYLOAD") &&
        !content.includes("CANDIDATE_TWO_PAYLOAD"),
      "neither candidate was written",
    );
  } finally {
    Deno.removeSync(tmp);
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - appendStepSummaryFirstFit no-ops when the path is unset", async () => {
  assertEquals(appendStepSummaryFirstFit(["a", "b"], null), -1);
  assertEquals(appendStepSummaryFirstFit(["a", "b"], ""), -1);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - kExcerptMaxBytes is well under the step summary budget", async () => {
  // A single failure's excerpt must not be able to dominate the shared
  // step-summary budget on its own.
  assert(kExcerptMaxBytes < kStepSummaryBudgetBytes / 4);
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

  // Markdown inline-emphasis/code-span syntax must be neutralized too, or a
  // test name renders with unintended italics/emphasis or a broken table.
  const emphasisRow = summaryTableRow(
    "L-F11",
    "tests/x.qmd",
    "test_foo_bar with `code` and *emph* <tag>",
    500,
  );
  assert(
    emphasisRow.includes("test\\_foo\\_bar"),
    "underscores escaped so they don't trigger emphasis",
  );
  assert(
    emphasisRow.includes("\\`code\\`"),
    "backticks escaped so they don't open a code span",
  );
  assert(
    emphasisRow.includes("\\*emph\\*"),
    "asterisks escaped so they don't trigger emphasis",
  );
  assert(
    emphasisRow.includes("&lt;tag&gt;"),
    "angle brackets still escaped alongside markdown escaping",
  );

  // degraded row shares the same plain label rendering, empty duration cell
  const nameOnly = summaryTableRowNameOnly("L-F8", "tests/docs/smoke-all/x.qmd", "a|b");
  assert(nameOnly.startsWith("| L-F8 |"), "name-only row carries the label too");
  assert(nameOnly.includes("\\|"), "pipe escaped in name-only row");
  assert(nameOnly.trimEnd().endsWith("| |"), "empty duration cell");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - summaryCell escapes a pre-existing backslash before escaping markdown punctuation", async () => {
  // A literal backslash immediately preceding a character we escape (e.g. a
  // Windows-path-flavored test name) must not neutralize that escape by
  // pairing with the pre-existing backslash. Escaping order matters: the
  // backslash itself must be escaped FIRST, before `_`/`` ` ``/`*` are
  // escaped, or the freshly-added escape backslash combines with the
  // original one into a `\\` (escaped backslash) that leaves the character
  // after it unescaped and "live" in Markdown.
  const row = summaryTableRow("L-F12", "tests/x.qmd", "\\_foo_", 100);
  const expected = "\\".repeat(3) + "_foo" + "\\_";
  assert(
    row.includes(expected),
    `expected the pre-existing backslash to be escaped independently, got: ${row}`,
  );
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

// deno-lint-ignore require-await
unitTest("gha-reporting - a failing summary write is swallowed", async () => {
  // The harness appends to the summary while a test failure is already in
  // flight; an ENOSPC/EACCES there must not replace the failure. A path
  // inside a directory that does not exist is the portable stand-in.
  const dir = Deno.makeTempDirSync({ prefix: "quarto-summary" });
  try {
    const unwritable = join(dir, "no-such-dir", "summary.md");
    stepSummary("| row |\n", unwritable);
    assertEquals(stepSummarySize(unwritable), 0, "nothing was written");
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - a failing counter write is swallowed", async () => {
  // Same contract for the sidecar ordinal counter: recordFailure() runs on
  // the failure path, so it must degrade rather than throw.
  const dir = Deno.makeTempDirSync({ prefix: "quarto-counter" });
  try {
    const unwritable = join(dir, "no-such-dir", "counter");
    const budget = new AnnotationBudget(9, unwritable);
    assertEquals(budget.recordFailure(), {
      ordinal: 1,
      emitAnnotation: true,
      emitAggregate: false,
    });
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("gha-reporting - a permanently failing counter write still yields monotonic ordinals and one aggregate", async () => {
  // A single swallowed write (previous test) isn't the whole contract: if
  // every write keeps failing, readCount() must stop re-reading the same
  // stale (or absent) persisted value on each call, or the ordinal repeats
  // forever and the aggregate (ordinal === max + 1) never fires.
  const dir = Deno.makeTempDirSync({ prefix: "quarto-counter" });
  try {
    const unwritable = join(dir, "no-such-dir", "counter");
    const budget = new AnnotationBudget(2, unwritable);
    const decisions = [];
    for (let i = 0; i < 4; i++) {
      decisions.push(budget.recordFailure());
    }
    assertEquals(decisions.map((d) => d.ordinal), [1, 2, 3, 4]);
    assertEquals(decisions.map((d) => d.emitAggregate), [
      false,
      false,
      true,
      false,
    ]);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
