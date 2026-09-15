/*
 * harness-reporting-fixture.ts
 *
 * Deliberately failing fixture for harness-failure-reporting.test.ts.
 *
 * The name intentionally does not match *.test.ts, so normal test discovery
 * skips it and grouping falls back to the body-time origin.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";

// deno-lint-ignore require-await
unitTest("fixture passes", async () => {});

// deno-lint-ignore require-await
unitTest("fixture verify throws", async () => {
  throw new Error("FIXTURE_PLAIN_BOOM");
});

// deno-lint-ignore require-await
unitTest("fixture teardown throws", async () => {}, {
  teardown: () => {
    throw new Error("FIXTURE_TEARDOWN_BOOM");
  },
});

// deno-lint-ignore require-await
unitTest("fixture prereq throws", async () => {}, {
  prereq: () => {
    throw new Error("FIXTURE_PREREQ_BOOM");
  },
});

// deno-lint-ignore require-await
unitTest("fixture throws a non-Error", async () => {
  throw "FIXTURE_STRING_BOOM";
});

// deno-lint-ignore require-await
unitTest("fixture verify and teardown both throw", async () => {
  throw new Error("FIXTURE_VERIFY_BOOM");
}, {
  teardown: () => {
    throw new Error("FIXTURE_TEARDOWN_BOOM_2");
  },
});

// Exercise byte limits independently of line limits.
// deno-lint-ignore require-await
unitTest("fixture throws with a huge excerpt line", async () => {
  throw new Error("FIXTURE_HUGE_LINE_" + "z".repeat(300 * 1024));
});

// Exercise line limits while retaining a teardown failure.
// deno-lint-ignore require-await
unitTest(
  "fixture throws a multi-line message and teardown also throws",
  async () => {
    const lines = Array.from(
      { length: 20 },
      (_, i) => `FIXTURE_MULTILINE_PRIMARY_LINE_${i}`,
    );
    throw new Error(lines.join("\n"));
  },
  {
    teardown: () => {
      throw new Error("FIXTURE_MULTILINE_TEARDOWN_BOOM");
    },
  },
);

// Exercise the combined byte and line limits.
// deno-lint-ignore require-await
unitTest(
  "fixture throws a primary message that trips both the line and byte caps, with teardown throwing too",
  async () => {
    const lines = Array.from(
      { length: 17 },
      (_, i) => `FIXTURE_BOTHCAPS_PRIMARY_LINE_${i}_` + "x".repeat(220),
    );
    throw new Error(lines.join("\n"));
  },
  {
    teardown: () => {
      throw new Error("FIXTURE_BOTHCAPS_TEARDOWN_BOOM");
    },
  },
);

// Ensure annotation truncation retains the teardown failure.
// deno-lint-ignore require-await
unitTest(
  "fixture throws a huge single-line message and teardown also throws",
  async () => {
    throw new Error("FIXTURE_HUGELINE_PRIMARY_" + "y".repeat(300 * 1024));
  },
  {
    teardown: () => {
      throw new Error("FIXTURE_HUGELINE_TEARDOWN_BOOM");
    },
  },
);
