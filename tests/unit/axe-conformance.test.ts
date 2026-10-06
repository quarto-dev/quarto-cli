/*
 * axe-conformance.test.ts
 *
 * Tests the WCAG conformance label our axe document reporter derives from a
 * violation's axe-core `tags` array (https://github.com/quarto-dev/quarto-cli/issues/14604).
 *
 * These exercise our own formatting, not axe-core's rule data: every input is a
 * hand-written `tags` array (the contract axe hands us), and assertions cover
 * only how we turn those tags into a label. An axe-core upgrade that re-tags a
 * rule therefore cannot break these tests.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { axeConformanceLevel } from "../../src/resources/formats/html/axe/axe-check.js";

unitTest(
  "axeConformanceLevel - best-practice tag yields Best Practice",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["best-practice", "cat.color"]),
      "Best Practice",
    );
  },
);

unitTest(
  "axeConformanceLevel - version+level with single criterion (issue #14604 example)",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["cat.text-alternatives", "wcag2a", "wcag111"]),
      "WCAG 2.0 A (1.1.1)",
    );
  },
);

unitTest(
  "axeConformanceLevel - level AA criterion",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["cat.color", "wcag2aa", "wcag143"]),
      "WCAG 2.0 AA (1.4.3)",
    );
  },
);

unitTest(
  "axeConformanceLevel - multiple criteria sort numerically, not lexically",
  // deno-lint-ignore require-await
  async () => {
    // 1.4.3 must precede 1.4.10; a lexical sort would put "1.4.10" first.
    assertEquals(
      axeConformanceLevel(["wcag2aa", "wcag143", "wcag1410"]),
      "WCAG 2.0 AA (1.4.3, 1.4.10)",
    );
  },
);

unitTest(
  "axeConformanceLevel - criteria order is independent of tag order",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["wcag2a", "wcag412", "wcag244"]),
      "WCAG 2.0 A (2.4.4, 4.1.2)",
    );
  },
);

unitTest(
  "axeConformanceLevel - obsolete criterion is flagged",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["wcag2a-obsolete", "wcag411"]),
      "Obsolete WCAG 2.0 A (4.1.1)",
    );
  },
);

unitTest(
  "axeConformanceLevel - WCAG 2.1 and 2.2 versions",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(axeConformanceLevel(["wcag21aa"]), "WCAG 2.1 AA");
    assertEquals(axeConformanceLevel(["wcag22aa"]), "WCAG 2.2 AA");
  },
);

unitTest(
  "axeConformanceLevel - no conformance tags falls back to empty string",
  // deno-lint-ignore require-await
  async () => {
    // Caller renders the impact alone when this is "".
    assertEquals(axeConformanceLevel(["cat.color"]), "");
  },
);

unitTest(
  "axeConformanceLevel - best-practice takes precedence over any WCAG tags",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      axeConformanceLevel(["best-practice", "wcag2a", "wcag111"]),
      "Best Practice",
    );
  },
);
