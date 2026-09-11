/*
 * gha-grouping.test.ts
 *
 * Tests for the per-test-file GitHub Actions grouping state machine (Phase 2
 * of dev-docs/ci-test-log-grouping-design.md): open/close on file change,
 * defensive close when nothing is open, the failure-path close + same-file
 * reopen, the ownership gate (both env dimensions), and the single-open-group
 * invariant.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { GroupEmitter, testFileUrlFromStack } from "../gha-grouping.ts";
import { harnessOwnsStep } from "../../src/tools/github.ts";

// Records every marker the emitter produces, in order, and tracks the
// running open-group depth so the single-open-group invariant can be asserted.
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
  // no stray endgroup before the very first group
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
  // repeated entries for the same file are no-ops
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
  // never more than one group open at a time
  assertEquals(rec.maxDepth, 1);
  assertEquals(rec.depth, 1);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - close is defensive when nothing is open", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  // closing with no open group emits nothing (no stray ::endgroup::)
  e.close();
  assertEquals(rec.markers, []);
  assertEquals(e.currentFile(), undefined);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - failure-path close, then same-file reopen", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  // failure path closes the group so the FAILED line lands outside it
  e.close();
  assertEquals(e.currentFile(), undefined);
  // the next test of the same file re-opens a fresh (sequential) group
  e.enterFile("smoke/a.test.ts");
  assertEquals(rec.markers, [
    "group:smoke/a.test.ts",
    "endgroup",
    "group:smoke/a.test.ts",
  ]);
  assertEquals(rec.maxDepth, 1);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - double close never double-emits", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  e.enterFile("smoke/a.test.ts");
  // failure-path close followed by the unload close
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
unitTest("gha-grouping - single-open-group invariant across many files", async () => {
  const rec = new Recorder();
  const e = rec.emitter();
  for (const f of ["a", "b", "c", "d"]) {
    e.enterFile(`smoke/${f}.test.ts`);
  }
  e.close();
  // depth never exceeded 1, and everything is closed at the end
  assertEquals(rec.maxDepth, 1);
  assertEquals(rec.depth, 0);
  // balanced: one endgroup per group
  const opens = rec.markers.filter((m) => m.startsWith("group:")).length;
  const closes = rec.markers.filter((m) => m === "endgroup").length;
  assertEquals(opens, closes);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - ownership gate honors both env dimensions", async () => {
  // The singleton wrappers gate on harnessOwnsStep(); confirm its truth table
  // matches the grouping contract: emit only on CI with no orchestrator.
  // null = "treat env var as unset"; an explicit undefined would read the
  // REAL env via the default parameter — set inside CI bucket steps.
  assertEquals(harnessOwnsStep(true, null), true);
  assertEquals(harnessOwnsStep(true, ""), true);
  assertEquals(harnessOwnsStep(true, "1"), false);
  assertEquals(harnessOwnsStep(false, null), false);
  assertEquals(harnessOwnsStep(false, "1"), false);

  // a GroupEmitter driven by that gate emits nothing when orchestrated
  const rec = new Recorder();
  const orchestrated = rec.emitter(() => harnessOwnsStep(true, "1"));
  orchestrated.enterFile("smoke/a.test.ts");
  assertEquals(rec.markers, []);
  assert(rec.maxDepth === 0);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: Linux bare frame yields the test-file URL", async () => {
  const stack = [
    "Error",
    "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
    "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
    "    at file:///home/runner/quarto-cli/tests/unit/foo.test.ts:12:1",
  ].join("\n");
  // the trailing :line:column is stripped; harness frames (.ts, not .test.ts)
  // are skipped implicitly
  assertEquals(
    testFileUrlFromStack(stack),
    "file:///home/runner/quarto-cli/tests/unit/foo.test.ts",
  );
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: Windows drive-letter frame yields the test-file URL", async () => {
  const stack = [
    "Error",
    "    at test (file:///C:/Users/x/quarto-cli/tests/test.ts:340:20)",
    "    at file:///C:/Users/x/quarto-cli/tests/smoke/render/bar.test.ts:3:5",
  ].join("\n");
  // the drive-letter colon must not be mistaken for the :line:column suffix
  assertEquals(
    testFileUrlFromStack(stack),
    "file:///C:/Users/x/quarto-cli/tests/smoke/render/bar.test.ts",
  );
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: function-wrapped frame in parentheses", async () => {
  const stack = [
    "Error",
    "    at Object.fn (file:///home/runner/quarto-cli/tests/unit/baz.test.ts:9:1)",
  ].join("\n");
  // the wrapping parentheses are not part of the URL
  assertEquals(
    testFileUrlFromStack(stack),
    "file:///home/runner/quarto-cli/tests/unit/baz.test.ts",
  );
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: first test-file frame wins over later ones", async () => {
  const stack = [
    "Error",
    "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
    "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
    "    at file:///home/runner/quarto-cli/tests/unit/first.test.ts:5:1",
    "    at file:///home/runner/quarto-cli/tests/unit/second.test.ts:8:1",
  ].join("\n");
  // reading innermost-outward, the closest test file is the registering one
  assertEquals(
    testFileUrlFromStack(stack),
    "file:///home/runner/quarto-cli/tests/unit/first.test.ts",
  );
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: no test-file frame yields undefined", async () => {
  const stack = [
    "Error",
    "    at testFileUrlFromStack (file:///home/runner/quarto-cli/tests/gha-grouping.ts:30:10)",
    "    at test (file:///home/runner/quarto-cli/tests/test.ts:340:20)",
  ].join("\n");
  // only harness frames present — nothing to attribute the group to
  assertEquals(testFileUrlFromStack(stack), undefined);
});

// deno-lint-ignore require-await
unitTest("gha-grouping - stack: missing or malformed stack yields undefined", async () => {
  // a missing stack (some runtimes), an empty string, and free text with no
  // file:// frame all resolve to undefined rather than throwing
  assertEquals(testFileUrlFromStack(undefined), undefined);
  assertEquals(testFileUrlFromStack(""), undefined);
  assertEquals(testFileUrlFromStack("not a stack trace at all"), undefined);
});
