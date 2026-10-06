/*
 * gha-grouping.test.ts
 *
 * Tests for per-file GitHub Actions grouping.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { GroupEmitter, testFileUrlFromStack } from "../gha-grouping.ts";
import { harnessOwnsStep } from "../../src/tools/github.ts";

class Recorder {
  readonly markers: string[] = [];
  depth = 0;
  maxDepth = 0;

  start = (title: string) => {
    this.markers.push(`group:${title}`);
    this.depth++;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
  };
  end = () => {
    this.markers.push("endgroup");
    this.depth--;
  };

  emitter(gate: () => boolean = () => true): GroupEmitter {
    return new GroupEmitter(gate, this.start, this.end);
  }
}

// deno-lint-ignore require-await
unitTest("gha-grouping - opens a group on first file", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  assertEquals(rec.markers, ["group:smoke/a.test.ts"]);
  assertEquals(e.currentFile(), "smoke/a.test.ts");
});

// deno-lint-ignore require-await
unitTest("gha-grouping - same file keeps one group open", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  e.enterFile("smoke/a.test.ts");
  e.enterFile("smoke/a.test.ts");
  assertEquals(rec.markers, ["group:smoke/a.test.ts"]);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - file change closes then opens", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  e.enterFile("smoke/b.test.ts");
  assertEquals(rec.markers, [
    "group:smoke/a.test.ts",
    "endgroup",
    "group:smoke/b.test.ts",
  ]);
  assertEquals(rec.maxDepth, 1);
  assertEquals(rec.depth, 1);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - close is defensive when nothing is open", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.close();
  assertEquals(rec.markers, []);
  assertEquals(e.currentFile(), undefined);
});

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - failure-path close, then same-file reopen",
  async () => {
    const rec = new Recorder();
    const e = rec.emitter();
    e.enterFile("smoke/a.test.ts");
    e.close();
    assertEquals(e.currentFile(), undefined);
    e.enterFile("smoke/a.test.ts");
    assertEquals(rec.markers, [
      "group:smoke/a.test.ts",
      "endgroup",
      "group:smoke/a.test.ts",
    ]);
    assertEquals(rec.maxDepth, 1);
  },
);

// deno-lint-ignore require-await
unitTest("gha-grouping - double close never double-emits", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  e.close();
  e.close();
  assertEquals(rec.markers, ["group:smoke/a.test.ts", "endgroup"]);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - gate off: no emission, no state change", async () => {
  const rec = new Recorder();
  const e = rec.emitter(() => false);
  e.enterFile("smoke/a.test.ts");
  e.enterFile("smoke/b.test.ts");
  e.close();
  assertEquals(rec.markers, []);
  assertEquals(e.currentFile(), undefined);
});

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - single-open-group invariant across many files",
  async () => {
    const rec = new Recorder();
    const e = rec.emitter();
    for (const f of ["a", "b", "c", "d"]) {
      e.enterFile(`smoke/${f}.test.ts`);
    }
    e.close();
    assertEquals(rec.maxDepth, 1);
    assertEquals(rec.depth, 0);
    const opens = rec.markers.filter((m) => m.startsWith("group:")).length;
    const closes = rec.markers.filter((m) => m === "endgroup").length;
    assertEquals(opens, closes);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - ownership gate honors both env dimensions",
  async () => {
    assertEquals(harnessOwnsStep(true, null), true);
    assertEquals(harnessOwnsStep(true, ""), true);
    assertEquals(harnessOwnsStep(true, "1"), false);
    assertEquals(harnessOwnsStep(false, null), false);
    assertEquals(harnessOwnsStep(false, "1"), false);

    const rec = new Recorder();
    const orchestrated = rec.emitter(() => harnessOwnsStep(true, "1"));
    orchestrated.enterFile("smoke/a.test.ts");
    assertEquals(rec.markers, []);
    assert(rec.maxDepth === 0);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: Linux bare frame yields the test-file URL",
  async () => {
    const stack = [
      "Error",
      "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
      "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
      "    at file:///home/runner/quarto-cli/tests/unit/foo.test.ts:12:1",
    ].join("\n");
    assertEquals(
      testFileUrlFromStack(stack),
      "file:///home/runner/quarto-cli/tests/unit/foo.test.ts",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: Windows drive-letter frame yields the test-file URL",
  async () => {
    const stack = [
      "Error",
      "    at test (file:///C:/Users/x/quarto-cli/tests/test.ts:340:20)",
      "    at file:///C:/Users/x/quarto-cli/tests/smoke/render/bar.test.ts:3:5",
    ].join("\n");
    assertEquals(
      testFileUrlFromStack(stack),
      "file:///C:/Users/x/quarto-cli/tests/smoke/render/bar.test.ts",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: function-wrapped frame in parentheses",
  async () => {
    const stack = [
      "Error",
      "    at Object.fn (file:///home/runner/quarto-cli/tests/unit/baz.test.ts:9:1)",
    ].join("\n");
    assertEquals(
      testFileUrlFromStack(stack),
      "file:///home/runner/quarto-cli/tests/unit/baz.test.ts",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: first test-file frame wins over later ones",
  async () => {
    const stack = [
      "Error",
      "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
      "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
      "    at file:///home/runner/quarto-cli/tests/unit/first.test.ts:5:1",
      "    at file:///home/runner/quarto-cli/tests/unit/second.test.ts:8:1",
    ].join("\n");
    assertEquals(
      testFileUrlFromStack(stack),
      "file:///home/runner/quarto-cli/tests/unit/first.test.ts",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: no test-file frame yields undefined",
  async () => {
    const stack = [
      "Error",
      "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
      "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
    ].join("\n");
    assertEquals(testFileUrlFromStack(stack), undefined);
  },
);

// deno-lint-ignore require-await
unitTest(
  "gha-grouping - stack: missing or malformed stack yields undefined",
  async () => {
    assertEquals(testFileUrlFromStack(undefined), undefined);
    assertEquals(testFileUrlFromStack(""), undefined);
    assertEquals(testFileUrlFromStack("not a stack trace at all"), undefined);
  },
);
