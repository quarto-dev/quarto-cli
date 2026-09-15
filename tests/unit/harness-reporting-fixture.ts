/*
 * harness-reporting-fixture.ts
 *
 * A harness test file that fails in each of the ways tests/test.ts's failure
 * reporting must cover. Driven by unit/harness-failure-reporting.test.ts,
 * which runs it in a child `deno test` process and inspects that child's
 * stdout and step-summary file.
 *
 * Deliberately failing, so the name is NOT *.test.ts: Deno's test discovery
 * (and therefore run-tests.sh/ps1 with no arguments) never picks it up. A
 * side effect is that registration-time group resolution finds no `.test.ts`
 * frame, so the group opens at body time instead - the documented Phase 2.1
 * fallback.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";

// Control: a test that passes outright (no row, no annotation).
// deno-lint-ignore require-await
unitTest("fixture passes", async () => {});

// The ordinary failure path: a plain Error out of verify, no teardown.
// deno-lint-ignore require-await
unitTest("fixture verify throws", async () => {
  throw new Error("FIXTURE_PLAIN_BOOM");
});

// A throwing teardown on an otherwise passing test.
// deno-lint-ignore require-await
unitTest("fixture teardown throws", async () => {}, {
  teardown: () => {
    throw new Error("FIXTURE_TEARDOWN_BOOM");
  },
});

// A lifecycle failure: prereq rejects before any log capture exists.
// deno-lint-ignore require-await
unitTest("fixture prereq throws", async () => {}, {
  prereq: () => {
    throw new Error("FIXTURE_PREREQ_BOOM");
  },
});

// A non-Error throw out of verify.
// deno-lint-ignore require-await
unitTest("fixture throws a non-Error", async () => {
  throw "FIXTURE_STRING_BOOM";
});

// A verify failure and a teardown failure together.
// deno-lint-ignore require-await
unitTest("fixture verify and teardown both throw", async () => {
  throw new Error("FIXTURE_VERIFY_BOOM");
}, {
  teardown: () => {
    throw new Error("FIXTURE_TEARDOWN_BOOM_2");
  },
});

// A single excerpt line long enough to blow past a per-excerpt byte cap (a
// base64 data URI or a serialized document in a real assertion message can
// look like this) — must not flow unbounded into the step summary or the
// annotation.
// deno-lint-ignore require-await
unitTest("fixture throws with a huge excerpt line", async () => {
  throw new Error("FIXTURE_HUGE_LINE_" + "z".repeat(300 * 1024));
});

// A primary message with many SHORT lines (well under the per-excerpt byte
// cap on its own) paired with a throwing teardown: the excerpt's line slice,
// not its byte cap, is what can crowd out the teardown banner and message
// that get appended after the primary.
// deno-lint-ignore require-await
unitTest("fixture throws a multi-line message and teardown also throws", async () => {
  const lines = Array.from(
    { length: 20 },
    (_, i) => `FIXTURE_MULTILINE_PRIMARY_LINE_${i}`,
  );
  throw new Error(lines.join("\n"));
}, {
  teardown: () => {
    throw new Error("FIXTURE_MULTILINE_TEARDOWN_BOOM");
  },
});

// A primary message whose first 17 lines each pass the excerpt's line cap on
// their own, but whose combined bytes exceed the primary's per-excerpt byte
// budget - paired with a throwing teardown. The truncation marker that byte
// capping can append is itself a line, and must not be the thing that pushes
// the teardown banner and message out of the 20-line excerpt.
// deno-lint-ignore require-await
unitTest("fixture throws a primary message that trips both the line and byte caps, with teardown throwing too", async () => {
  const lines = Array.from(
    { length: 17 },
    (_, i) => `FIXTURE_BOTHCAPS_PRIMARY_LINE_${i}_` + "x".repeat(220),
  );
  throw new Error(lines.join("\n"));
}, {
  teardown: () => {
    throw new Error("FIXTURE_BOTHCAPS_TEARDOWN_BOOM");
  },
});

// A single retained primary line that alone exceeds the annotation's own
// byte cap, paired with a throwing teardown: the annotation excerpt's byte
// truncation (applied AFTER the primary/banner/message are joined) must not
// cut into the joined string before the banner and message, or they're
// dropped from the annotation even though the step summary still shows them.
// deno-lint-ignore require-await
unitTest("fixture throws a huge single-line message and teardown also throws", async () => {
  throw new Error("FIXTURE_HUGELINE_PRIMARY_" + "y".repeat(300 * 1024));
}, {
  teardown: () => {
    throw new Error("FIXTURE_HUGELINE_TEARDOWN_BOOM");
  },
});
