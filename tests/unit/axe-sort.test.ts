/*
 * axe-sort.test.ts
 *
 * Tests the sort order our axe document reporter applies to violations:
 * impact (critical → serious → moderate → minor → null), then conformance
 * standard (WCAG A → AA → AAA → Best Practice → obsolete → none), then rule
 * id for deterministic output.
 *
 * These exercise our own ranking and comparison logic, not axe-core's rule
 * data: every input is a hand-written violation fixture (the contract axe
 * hands us). An axe-core upgrade that re-tags or re-ranks a rule therefore
 * cannot break these tests.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  compareViolations,
  impactRank,
  standardRank,
} from "../../src/resources/formats/html/axe/axe-check.js";

unitTest(
  "impactRank - orders critical → serious → moderate → minor → null",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(impactRank("critical"), 0);
    assertEquals(impactRank("serious"), 1);
    assertEquals(impactRank("moderate"), 2);
    assertEquals(impactRank("minor"), 3);
    assertEquals(impactRank(null), 4);
    assertEquals(impactRank("unheard-of"), 4);
  },
);

unitTest(
  "standardRank - orders A → AA → AAA → Best Practice → obsolete → none",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(standardRank(["wcag2a", "wcag111"]), 0);
    assertEquals(standardRank(["wcag21aa", "wcag143"]), 1);
    assertEquals(standardRank(["wcag2aaa"]), 2);
    assertEquals(standardRank(["best-practice", "cat.color"]), 3);
    assertEquals(standardRank(["wcag2a-obsolete", "wcag411"]), 4);
    assertEquals(standardRank(["cat.color"]), 5);
  },
);

unitTest(
  "standardRank - best-practice takes precedence over any WCAG tags",
  // deno-lint-ignore require-await
  async () => {
    // Mirrors axeConformanceLevel: axe tags best-practice rules with related
    // WCAG criteria, but they're still recommendations, not requirements.
    assertEquals(standardRank(["best-practice", "wcag2a", "wcag111"]), 3);
  },
);

unitTest(
  "compareViolations - impact ordering, null impact last",
  // deno-lint-ignore require-await
  async () => {
    const violations = [
      { id: "r-minor", impact: "minor", tags: ["wcag2a"] },
      { id: "r-null", impact: null, tags: ["wcag2a"] },
      { id: "r-critical", impact: "critical", tags: ["wcag2a"] },
      { id: "r-moderate", impact: "moderate", tags: ["wcag2a"] },
      { id: "r-serious", impact: "serious", tags: ["wcag2a"] },
    ];
    assertEquals(
      violations.sort(compareViolations).map((v) => v.id),
      ["r-critical", "r-serious", "r-moderate", "r-minor", "r-null"],
    );
  },
);

unitTest(
  "compareViolations - standard breaks ties within an impact",
  // deno-lint-ignore require-await
  async () => {
    const violations = [
      { id: "r-none", impact: "serious", tags: ["cat.color"] },
      { id: "r-obsolete", impact: "serious", tags: ["wcag2a-obsolete"] },
      { id: "r-bp", impact: "serious", tags: ["best-practice"] },
      { id: "r-aa", impact: "serious", tags: ["wcag21aa", "wcag143"] },
      { id: "r-a", impact: "serious", tags: ["wcag2a", "wcag111"] },
    ];
    assertEquals(
      violations.sort(compareViolations).map((v) => v.id),
      ["r-a", "r-aa", "r-bp", "r-obsolete", "r-none"],
    );
  },
);

unitTest(
  "compareViolations - impact outranks standard",
  // deno-lint-ignore require-await
  async () => {
    // A critical best-practice violation precedes a minor WCAG A one.
    const violations = [
      { id: "r-minor-a", impact: "minor", tags: ["wcag2a"] },
      { id: "r-critical-bp", impact: "critical", tags: ["best-practice"] },
    ];
    assertEquals(
      violations.sort(compareViolations).map((v) => v.id),
      ["r-critical-bp", "r-minor-a"],
    );
  },
);

unitTest(
  "compareViolations - rule id breaks full ties deterministically",
  // deno-lint-ignore require-await
  async () => {
    const violations = [
      { id: "image-alt", impact: "critical", tags: ["wcag2a"] },
      { id: "area-alt", impact: "critical", tags: ["wcag2a"] },
      { id: "button-name", impact: "critical", tags: ["wcag2a"] },
    ];
    assertEquals(
      violations.sort(compareViolations).map((v) => v.id),
      ["area-alt", "button-name", "image-alt"],
    );
  },
);

unitTest(
  "compareViolations - sorting a copy leaves the input array untouched",
  // deno-lint-ignore require-await
  async () => {
    // The document reporter sorts a copy so axeResult keeps axe-core's raw
    // order for the json reporter.
    const violations = [
      { id: "r-minor", impact: "minor", tags: ["wcag2a"] },
      { id: "r-critical", impact: "critical", tags: ["wcag2a"] },
    ];
    const sorted = [...violations].sort(compareViolations);
    assertEquals(sorted.map((v) => v.id), ["r-critical", "r-minor"]);
    assertEquals(violations.map((v) => v.id), ["r-minor", "r-critical"]);
  },
);
