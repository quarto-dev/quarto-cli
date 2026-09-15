/*
 * check-gha-log.test.ts
 *
 * Tests for the CI log-grouping regression guard (tests/tools/check-gha-log.ts).
 * Covers tolerance of a trailing-whitespace `::endgroup::` — the runner still
 * parses such a line as a valid close, so the checker must treat it as one
 * too, rather than misreporting it as a marker not at column 0 and then
 * cascading false "nested group" violations for everything that follows.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { checkLog } from "../tools/check-gha-log.ts";

// deno-lint-ignore require-await
unitTest(
  "check-gha-log - ::endgroup:: with trailing whitespace is a clean close",
  async () => {
    const log = [
      "::group::a",
      "some output",
      "::endgroup:: ",
    ].join("\n");
    assertEquals(checkLog(log), []);
  },
);

// deno-lint-ignore require-await
unitTest(
  "check-gha-log - trailing-whitespace close still decrements depth for the next group",
  async () => {
    const log = [
      "::group::a",
      "::endgroup:: ",
      "::group::b",
      "::endgroup::",
    ].join("\n");
    assertEquals(checkLog(log), []);
  },
);

// deno-lint-ignore require-await
unitTest(
  "check-gha-log - leading-whitespace ::endgroup:: is still a column-0 violation",
  async () => {
    const log = [
      "::group::a",
      "  ::endgroup::",
    ].join("\n");
    const violations = checkLog(log);
    // Unaffected by the trailing-whitespace fix: a leading-whitespace marker
    // never matches isGroupClose, so it still falls into the column-0 branch
    // and (since that branch returns without decrementing depth) still
    // cascades into a "group left open at end of log" violation too.
    assertEquals(violations.length, 2);
    assertEquals(violations[0].message, "group marker not at column 0");
  },
);

// deno-lint-ignore require-await
unitTest(
  "check-gha-log - a genuinely nested ::group:: is still reported",
  async () => {
    const log = [
      "::group::a",
      "::group::b",
      "::endgroup::",
      "::endgroup::",
    ].join("\n");
    const violations = checkLog(log);
    assertEquals(violations.length, 1);
    assertEquals(violations[0].message.startsWith("nested ::group::"), true);
  },
);

// deno-lint-ignore require-await
unitTest(
  "check-gha-log - a group left open at end of log is still reported",
  async () => {
    const log = ["::group::a", "some output"].join("\n");
    const violations = checkLog(log);
    assertEquals(violations.length, 1);
    assertEquals(
      violations[0].message.startsWith("group left open at end of log"),
      true,
    );
  },
);
