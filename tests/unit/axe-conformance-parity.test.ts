/*
 * axe-conformance-parity.test.ts
 *
 * Asserts that the scanner's conformance labelling agrees with the render-time
 * one, function for function and input for input.
 *
 * There are two implementations on purpose. `axe-check.js` runs in the browser
 * and cannot be imported into the CLI bundle without dragging the whole overlay
 * and its page globals along (see src/command/dev-call/axe/conformance.ts), so
 * the scanner mirrors its three pure labellers in TypeScript.
 *
 * That duplication is only safe while something notices a divergence. This is
 * that something: it imports both and compares them over the tag shapes axe
 * emits. Tests aren't bundled, so importing the browser module here is free.
 *
 * If this fails, one side changed. Change the other, or say why they should
 * differ.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  axeConformanceLevel as tsConformanceLevel,
  impactRank as tsImpactRank,
  standardRank as tsStandardRank,
} from "../../src/command/dev-call/axe/conformance.ts";
import {
  axeConformanceLevel as jsConformanceLevel,
  impactRank as jsImpactRank,
  standardRank as jsStandardRank,
} from "../../src/resources/formats/html/axe/axe-check.js";

/**
 * Tag arrays covering every branch both implementations have: best-practice,
 * each WCAG version and level, single and multiple criteria, multi-digit
 * criteria, obsolete criteria, and no conformance tags at all.
 */
const kTagCases: string[][] = [
  ["best-practice", "cat.color"],
  ["cat.text-alternatives", "wcag2a", "wcag111"],
  ["cat.color", "wcag2aa", "wcag143"],
  ["cat.color", "wcag2aaa", "wcag146"],
  ["cat.keyboard", "wcag21a", "wcag2131"],
  ["cat.sensory-and-visual-cues", "wcag21aa", "wcag1410"],
  ["cat.forms", "wcag22aa", "wcag253"],
  // more than one criterion: the label lists them, numerically sorted
  ["cat.name-role-value", "wcag2a", "wcag244", "wcag412"],
  // sorting must be numeric, not lexicographic: 1.4.10 sorts after 1.4.3
  ["cat.color", "wcag2aa", "wcag1410", "wcag143"],
  // withdrawn criterion, e.g. the deprecated duplicate-id rule
  ["cat.parsing", "wcag2a-obsolete", "wcag411"],
  // no conformance tags: both must decline to invent a level
  ["cat.semantics"],
  [],
];

const kImpacts = [
  "critical",
  "serious",
  "moderate",
  "minor",
  null,
  undefined,
  "bogus",
];

unitTest(
  "conformance parity - axeConformanceLevel agrees with axe-check.js",
  // deno-lint-ignore require-await
  async () => {
    for (const tags of kTagCases) {
      assertEquals(
        tsConformanceLevel(tags),
        jsConformanceLevel(tags),
        `diverged on ${JSON.stringify(tags)}`,
      );
    }
  },
);

unitTest(
  "conformance parity - standardRank agrees with axe-check.js",
  // deno-lint-ignore require-await
  async () => {
    for (const tags of kTagCases) {
      assertEquals(
        tsStandardRank(tags),
        jsStandardRank(tags),
        `diverged on ${JSON.stringify(tags)}`,
      );
    }
  },
);

unitTest(
  "conformance parity - impactRank agrees with axe-check.js",
  // deno-lint-ignore require-await
  async () => {
    for (const impact of kImpacts) {
      assertEquals(
        tsImpactRank(impact),
        jsImpactRank(impact),
        `diverged on ${JSON.stringify(impact)}`,
      );
    }
  },
);

unitTest(
  "conformance parity - the labels are what a reader expects",
  // deno-lint-ignore require-await
  async () => {
    // Parity alone would be satisfied by both being wrong, so pin a few
    // absolute values too.
    assertEquals(
      tsConformanceLevel(["best-practice", "cat.color"]),
      "Best Practice",
    );
    assertEquals(
      tsConformanceLevel(["wcag2a", "wcag111"]),
      "WCAG 2.0 A (1.1.1)",
    );
    assertEquals(
      tsConformanceLevel(["wcag2aa", "wcag1410", "wcag143"]),
      "WCAG 2.0 AA (1.4.3, 1.4.10)",
    );
    assertEquals(
      tsConformanceLevel(["wcag2a-obsolete", "wcag411"]),
      "Obsolete WCAG 2.0 A (4.1.1)",
    );
    assertEquals(tsConformanceLevel(["cat.semantics"]), "");

    // ranks are ascending, worst first
    assertEquals(tsStandardRank(["wcag2a"]), 0);
    assertEquals(tsStandardRank(["wcag21aa"]), 1);
    assertEquals(tsStandardRank(["best-practice"]), 3);
    assertEquals(tsStandardRank(["cat.semantics"]), 5);
    assertEquals(tsImpactRank("critical"), 0);
    assertEquals(tsImpactRank(null), 4);
  },
);
