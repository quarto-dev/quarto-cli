/*
 * github-actions-reporting.test.ts
 *
 * Tests for GitHub Actions test-reporting helpers.
 *
 * Copyright (C) 2026 Posit Software, PBC
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
unitTest(
  "gha-reporting - annotation budget caps at 9 then aggregates once",
  async () => {
    const budget = new AnnotationBudget(9, null);
    const decisions = [];
    for (let i = 0; i < 12; i++) {
      decisions.push(budget.recordFailure());
    }
    assertEquals(decisions.filter((d) => d.emitAnnotation).length, 9);
    assertEquals(decisions.slice(0, 9).every((d) => d.emitAnnotation), true);
    assertEquals(decisions.map((d) => d.emitAggregate), [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    assertEquals(decisions.map((d) => d.ordinal), [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
    ]);
  },
);

// deno-lint-ignore require-await
unitTest("gha-reporting - annotation budget honors a custom cap", async () => {
  const budget = new AnnotationBudget(2, null);
  assertEquals(budget.recordFailure(), {
    ordinal: 1,
    emitAnnotation: true,
    emitAggregate: false,
  });
  assertEquals(budget.recordFailure(), {
    ordinal: 2,
    emitAnnotation: true,
    emitAggregate: false,
  });
  assertEquals(budget.recordFailure(), {
    ordinal: 3,
    emitAnnotation: false,
    emitAggregate: true,
  });
  assertEquals(budget.recordFailure(), {
    ordinal: 4,
    emitAnnotation: false,
    emitAggregate: false,
  });
});

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotation budget is step-wide across module instances",
  async () => {
    const counter = Deno.makeTempFileSync({ suffix: ".count" });
    Deno.removeSync(counter); // budget must cope with a not-yet-created file
    try {
      const fileA = new AnnotationBudget(3, counter);
      const fileB = new AnnotationBudget(3, counter);
      assertEquals(fileA.recordFailure(), {
        ordinal: 1,
        emitAnnotation: true,
        emitAggregate: false,
      });
      assertEquals(fileA.recordFailure(), {
        ordinal: 2,
        emitAnnotation: true,
        emitAggregate: false,
      });
      assertEquals(fileB.recordFailure(), {
        ordinal: 3,
        emitAnnotation: true,
        emitAggregate: false,
      });
      assertEquals(fileB.recordFailure(), {
        ordinal: 4,
        emitAnnotation: false,
        emitAggregate: true,
      });
      assertEquals(fileA.recordFailure(), {
        ordinal: 5,
        emitAnnotation: false,
        emitAggregate: false,
      });
      assertEquals(fileB.recordFailure(), {
        ordinal: 6,
        emitAnnotation: false,
        emitAggregate: false,
      });
    } finally {
      try {
        Deno.removeSync(counter);
      } catch {
        // The counter may not have been created.
      }
    }
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - failureLabel prefixes the ordinal with the runner OS",
  async () => {
    assertEquals(failureLabel(7, "Linux"), "L-F7");
    assertEquals(failureLabel(7, "Windows"), "W-F7");
    assertEquals(failureLabel(7, "macOS"), "M-F7");
    assertEquals(failureLabel(1, ""), "X-F1");
    assertEquals(failureLabel(3, "FreeBSD"), "X-F3");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - failureLabel discriminates same-OS jobs by workflow tag",
  async () => {
    assertEquals(failureLabel(1, "Linux", "b01"), "Lb01-F1");
    assertEquals(failureLabel(1, "Linux", "b02"), "Lb02-F1");
    assert(
      failureLabel(1, "Linux", "b01") !== failureLabel(1, "Linux", "b02"),
      "same OS, same ordinal, different leg → different label",
    );
    assertEquals(failureLabel(12, "Windows", "relsmk"), "Wrelsmk-F12");
    assertEquals(failureLabel(3, "macOS", "ngtsmk"), "Mngtsmk-F3");
    assertEquals(failureLabel(7, "Linux", "b07"), "Lb07-F7");
    assertEquals(failureLabel(7, "Linux", ""), "L-F7");
    assertEquals(failureLabel(7, "Linux"), "L-F7");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - failureLabel sanitizes the workflow tag",
  async () => {
    assertEquals(failureLabel(2, "Linux", "smoke | tests"), "Lsmoketes-F2");
    assertEquals(failureLabel(2, "Linux", "a*b_c-d"), "Labcd-F2");
    assertEquals(failureLabel(2, "Linux", "line\nbreak"), "Llinebrea-F2");
    assertEquals(failureLabel(2, "Linux", "0123456789"), "L01234567-F2");
    assertEquals(failureLabel(2, "Linux", "***"), "L-F2");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - excerptSignature is the first 3 non-empty ANSI-stripped lines",
  async () => {
    const excerpt = "\x1b[31mone\x1b[0m\n\n  two  \n\nthree\nfour\nfive";
    assertEquals(excerptSignature(excerpt), "one\n  two  \nthree");
    assertEquals(excerptSignature("only\n\n"), "only");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - identical-error excerpts share a signature; distinct ones don't",
  async () => {
    const a = "AssertionError: x\n  at foo\n  at bar\n  detail-a";
    const b = "AssertionError: x\n  at foo\n  at bar\n  detail-b"; // differs past line 3
    const c = "TypeError: y\n  at baz\n  at qux";
    assertEquals(
      excerptSignature(a),
      excerptSignature(b),
      "same first 3 lines cluster",
    );
    assert(
      excerptSignature(a) !== excerptSignature(c),
      "different errors do not cluster",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody trims to repro + 5 lines + summary pointer",
  async () => {
    const excerpt = "l1\nl2\nl3\nl4\nl5\nl6\nl7";
    const body = annotationBody(
      "./run-tests.sh x.qmd",
      excerpt,
      "L-F7",
      "detail",
    );
    assert(
      body.startsWith("./run-tests.sh x.qmd\n\n"),
      "repro then a blank line",
    );
    assert(
      body.includes("l1\nl2\nl3\nl4\nl5"),
      "first five excerpt lines kept",
    );
    assert(!body.includes("l6"), "sixth line dropped");
    assert(body.includes("…"), "ellipsis marks the truncation");
    assert(body.trimEnd().includes("L-F7"), "pointer line carries the label");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody pointer: a queued cluster gets honest, unconditional wording",
  async () => {
    const body = annotationBody(
      "./run-tests.sh x.qmd",
      "boom",
      "L-F7",
      "detail",
    );
    assert(body.includes("L-F7"), "pointer carries the label");
    assert(
      !body.includes("Full output"),
      "does not promise complete output exists",
    );
    assert(body.includes("step log"), "points the reader at the step log");
    assert(
      !body.includes("…"),
      "a short excerpt that fit under maxLines was not truncated, so no ellipsis is warranted",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody pointer: a degraded (name-only) row gets a distinct, accurate wording",
  async () => {
    const body = annotationBody(
      "./run-tests.sh x.qmd",
      "boom",
      "L-F8",
      "name-only",
    );
    assert(body.includes("L-F8"));
    assert(
      !body.includes("Full output"),
      "no promise that a detail block exists",
    );
    assert(body.includes("step log"), "points the reader at the step log");
    assert(
      body !== annotationBody("./run-tests.sh x.qmd", "boom", "L-F8", "detail"),
      "the two cases produce different wording",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody pointer: no row at all gets wording that names no summary target",
  async () => {
    const body = annotationBody("./run-tests.sh x.qmd", "boom", "L-F9", "none");
    assert(
      !body.includes("L-F9"),
      "does not point the reader at a summary row under this label",
    );
    assert(!body.includes("Failure row"), "does not claim any row exists");
    assert(
      !body.includes("Full output"),
      "does not promise complete output exists",
    );
    assert(body.includes("step log"), "points the reader at the step log");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody produces three distinct bodies for the three outcomes",
  async () => {
    const bodies = (["detail", "name-only", "none"] as const).map((outcome) =>
      annotationBody("./run-tests.sh x.qmd", "boom", "L-F10", outcome)
    );
    assertEquals(new Set(bodies).size, 3, "each outcome has its own wording");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - annotationBody bounds a huge excerpt by bytes even if the caller didn't",
  async () => {
    const huge = "z".repeat(300 * 1024);
    const body = annotationBody("./run-tests.sh x.qmd", huge, "L-F9", "detail");
    assert(!body.includes(huge), "the full huge excerpt is not embedded whole");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - truncateUtf8Bytes leaves content under the cap untouched",
  async () => {
    assertEquals(truncateUtf8Bytes("short", 100), "short");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - truncateUtf8Bytes bounds a huge single line by UTF-8 bytes",
  async () => {
    const huge = "z".repeat(1000);
    const truncated = truncateUtf8Bytes(huge, 100);
    assert(
      new TextEncoder().encode(truncated).length <= 100,
      "result stays within the byte budget",
    );
    assert(truncated.includes("truncated"), "marks that truncation happened");
    assert(truncated.length < huge.length, "shorter than the input");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - truncateUtf8Bytes cuts on a UTF-8 boundary, not mid-codepoint",
  async () => {
    // The 10-byte content budget splits a three-byte code point.
    const s = "€".repeat(50);
    const truncated = truncateUtf8Bytes(s, 25);
    assert(
      !truncated.includes("�"),
      "no replacement character from a split code point",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - truncateUtf8Bytes bounds the marker itself when maxBytes is below the marker's own length",
  async () => {
    for (const maxBytes of [0, 1, 5, 10, 14]) {
      const truncated = truncateUtf8Bytes("z".repeat(1000), maxBytes);
      assert(
        new TextEncoder().encode(truncated).length <= maxBytes,
        `maxBytes=${maxBytes}: result must not exceed the requested budget`,
      );
    }
  },
);

// deno-lint-ignore require-await
unitTest("gha-reporting - harnessOwnsStep gate", async () => {
  assertEquals(harnessOwnsStep(true, null), true);
  assertEquals(harnessOwnsStep(true, ""), true);
  assertEquals(harnessOwnsStep(true, "1"), false);
  assertEquals(harnessOwnsStep(false, null), false);
  assertEquals(harnessOwnsStep(false, "1"), false);
});

// deno-lint-ignore require-await
unitTest("gha-reporting - stripAnsi removes color codes", async () => {
  assertEquals(stripAnsi("\x1b[31mred\x1b[0m"), "red");
  assertEquals(
    stripAnsi("\x1b[1m\x1b[32mbold green\x1b[0m done"),
    "bold green done",
  );
  assertEquals(stripAnsi("no color here"), "no color here");
  assertEquals(stripAnsi("line1\n\x1b[31mline2\x1b[0m"), "line1\nline2");
});

unitTest(
  "gha-reporting - step summary size budget and degrade path",
  async () => {
    const tmp = Deno.makeTempFileSync({ suffix: ".md" });
    try {
      assertEquals(stepSummarySize(tmp), 0);

      stepSummary("x".repeat(100), tmp);
      assertEquals(stepSummarySize(tmp), 100);
      assert(
        stepSummarySize(tmp) < kStepSummaryBudgetBytes,
        "still under budget",
      );

      stepSummary("y".repeat(kStepSummaryBudgetBytes), tmp);
      assert(
        stepSummarySize(tmp) > kStepSummaryBudgetBytes,
        "now over budget → callers degrade to name-only rows",
      );

      stepSummary("ignored", "");
      stepSummary("ignored", null);
      assertEquals(stepSummarySize(""), 0);
      assertEquals(stepSummarySize(null), 0);
    } finally {
      Deno.removeSync(tmp);
    }
  },
);

unitTest(
  "gha-reporting - appendStepSummaryBounded writes when content fits and reports success",
  async () => {
    const tmp = Deno.makeTempFileSync({ suffix: ".md" });
    try {
      assertEquals(appendStepSummaryBounded("| row |\n", tmp), true);
      assertEquals(Deno.readTextFileSync(tmp), "| row |\n");
    } finally {
      Deno.removeSync(tmp);
    }
  },
);

unitTest(
  "gha-reporting - appendStepSummaryBounded refuses content that would exceed the budget, and reports failure",
  async () => {
    const tmp = Deno.makeTempFileSync({ suffix: ".md" });
    try {
      Deno.writeTextFileSync(tmp, "x".repeat(kStepSummaryBudgetBytes));
      assertEquals(appendStepSummaryBounded("more content", tmp), false);
    } finally {
      Deno.removeSync(tmp);
    }
  },
);

unitTest(
  "gha-reporting - appendStepSummaryBounded emits the truncation notice exactly once, even across repeated refusals",
  async () => {
    const tmp = Deno.makeTempFileSync({ suffix: ".md" });
    try {
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
      assertEquals(appendStepSummaryBounded("z".repeat(1000), tmp), false);
      assertEquals(appendStepSummaryBounded("w".repeat(1000), tmp), false);
      const afterMore = Deno.readTextFileSync(tmp);
      const occurrences = afterMore.split(kStepSummaryTruncationNotice).length -
        1;
      assertEquals(occurrences, 1, "the notice is emitted exactly once");
    } finally {
      Deno.removeSync(tmp);
    }
  },
);

unitTest(
  "gha-reporting - appendStepSummaryBounded never lets the file exceed the configured limit",
  async () => {
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
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - appendStepSummaryBounded no-ops when the path is unset",
  async () => {
    assertEquals(appendStepSummaryBounded("ignored", null), false);
    assertEquals(appendStepSummaryBounded("ignored", ""), false);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - appendStepSummaryBounded reports failure when the write itself fails, not just when the budget check refuses",
  async () => {
    const dir = Deno.makeTempDirSync({ prefix: "quarto-summary" });
    try {
      const unwritable = join(dir, "no-such-dir", "summary.md");
      assertEquals(appendStepSummaryBounded("| row |\n", unwritable), false);
    } finally {
      Deno.removeSync(dir, { recursive: true });
    }
  },
);

unitTest(
  "gha-reporting - appendStepSummaryFirstFit writes a smaller fallback that the notice would otherwise crowd out",
  async () => {
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
  },
);

unitTest(
  "gha-reporting - appendStepSummaryFirstFit returns 0 and emits no notice when the first candidate fits",
  async () => {
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
  },
);

unitTest(
  "gha-reporting - appendStepSummaryFirstFit returns -1 and emits the notice when nothing fits",
  async () => {
    const tmp = Deno.makeTempFileSync({ suffix: ".md" });
    try {
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
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - appendStepSummaryFirstFit no-ops when the path is unset",
  async () => {
    assertEquals(appendStepSummaryFirstFit(["a", "b"], null), -1);
    assertEquals(appendStepSummaryFirstFit(["a", "b"], ""), -1);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - kExcerptMaxBytes is well under the step summary budget",
  async () => {
    assert(kExcerptMaxBytes < kStepSummaryBudgetBytes / 4);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - summary table carries a plain-text label column",
  async () => {
    const header = summaryTableHeader();
    assert(
      header.startsWith("| # | Test file | Test | Duration |"),
      "leading # column",
    );

    const row = summaryTableRow(
      "L-F7",
      "tests/docs/smoke-all/x.qmd",
      "a|b\nc <tag>",
      1234,
    );
    assert(row.startsWith("| L-F7 |"), "plain label in the # column");
    assert(!row.includes("](#"), "no fragment-link syntax");
    assert(row.includes("\\|"), "pipe escaped");
    assert(!row.includes("b\nc"), "newline collapsed");
    assert(row.includes("&lt;tag&gt;"), "angle brackets escaped");
    assert(row.includes("1.23s"), "duration formatted");

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

    const nameOnly = summaryTableRowNameOnly(
      "L-F8",
      "tests/docs/smoke-all/x.qmd",
      "a|b",
    );
    assert(
      nameOnly.startsWith("| L-F8 |"),
      "name-only row carries the label too",
    );
    assert(nameOnly.includes("\\|"), "pipe escaped in name-only row");
    assert(nameOnly.trimEnd().endsWith("| |"), "empty duration cell");
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - summaryCell escapes a pre-existing backslash before escaping markdown punctuation",
  async () => {
    const row = summaryTableRow("L-F12", "tests/x.qmd", "\\_foo_", 100);
    const expected = "\\".repeat(3) + "_foo" + "\\_";
    assert(
      row.includes(expected),
      `expected the pre-existing backslash to be escaped independently, got: ${row}`,
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - single-member cluster renders a labeled detail block",
  async () => {
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
    assert(
      block.includes("#### L-F3"),
      "label-only heading precedes the block",
    );
    assert(
      block.includes("<summary><code>docs/smoke-all/x.qmd</code> — "),
      "summary label carries the test file",
    );
    assert(
      block.includes(
        "[smoke] &gt; quarto render docs/smoke-all/x.qmd &lt;b&gt;",
      ),
      "test name in label is HTML-escaped",
    );
    assert(
      !block.includes("tests)</summary>"),
      "no (N tests) count for a single member",
    );
    assert(!block.includes("<summary>output</summary>"), "no anonymous label");
    assert(block.includes("<pre>"));
    assert(block.includes("&lt;script&gt;"), "angle brackets escaped");
    assert(block.includes("&amp;"), "ampersand escaped");
    assert(
      block.includes("./run-tests.sh docs/smoke-all/x.qmd"),
      "repro in the block body",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - multi-member cluster lists members and shares one excerpt",
  async () => {
    const block = summaryClusterBlock({
      label: "L-F3",
      members: [
        {
          label: "L-F3",
          file: "a.qmd",
          testName: "first",
          repro: "./run-tests.sh a.qmd",
        },
        {
          label: "L-F9",
          file: "b.qmd",
          testName: "second",
          repro: "./run-tests.sh b.qmd",
        },
      ],
      excerpt: "shared boom",
    });
    assert(
      block.includes("#### L-F3"),
      "cluster anchored on the first member's label",
    );
    assert(block.includes("(2 tests)"), "member count in the summary label");
    assert(block.includes("L-F9"), "second member is listed");
    assert(
      block.includes("<code>b.qmd</code>") &&
        block.includes("./run-tests.sh b.qmd"),
      "per-member file and repro in the list",
    );
    assertEquals(
      (block.match(/shared boom/g) || []).length,
      1,
      "excerpt appears exactly once",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-reporting - multi-member cluster discloses whose excerpt is shown",
  async () => {
    const member = (label: string, file: string) => ({
      label,
      file,
      testName: file,
      repro: `./run-tests.sh ${file}`,
    });
    const multi = summaryClusterBlock({
      label: "L-F3",
      members: [member("L-F3", "a.qmd"), member("L-F9", "b.qmd")],
      excerpt: "shared boom",
    });
    assert(
      multi.includes(
        "Excerpt from L-F3. Other tests share only its first lines; " +
          "see the step log for each failure.",
      ),
      "multi-member block names the excerpt's source and points to the log",
    );
    const single = summaryClusterBlock({
      label: "L-F1",
      members: [member("L-F1", "a.qmd")],
      excerpt: "boom",
    });
    assert(
      !single.includes("Excerpt from"),
      "single-member block has no disclosure",
    );
  },
);

// deno-lint-ignore require-await
unitTest("gha-reporting - escaping of hostile test names", async () => {
  assertEquals(escapeData("a%b\nc\rd"), "a%25b%0Ac%0Dd");
  assertEquals(escapeProperty("a%b:c,d\ne"), "a%25b%3Ac%2Cd%0Ae");
  assert(escapeProperty("[smoke] > weird::name").includes("%3A%3A"));
  assertEquals(escapeProperty("100%,done"), "100%25%2Cdone");
});

// deno-lint-ignore require-await
unitTest("gha-reporting - a failing summary write is swallowed", async () => {
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
unitTest(
  "gha-reporting - a permanently failing counter write still yields monotonic ordinals and one aggregate",
  async () => {
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
  },
);
