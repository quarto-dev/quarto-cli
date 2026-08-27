/*
 * axe-matrix.test.ts
 *
 * `quarto call axe` against tests/docs/axe-scan/sites/matrix: the two axes
 * that justify scanning every page four times.
 *
 * Every planted failure on that site is conditional, and each is reachable by
 * exactly one route — a narrow viewport, an emulated colour-scheme preference,
 * or Quarto's own dark theme, selected by seeding the localStorage key its
 * colour-scheme script reads. A cell that scanned the wrong presentation
 * therefore fails an assertion here rather than quietly reporting a duplicate.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { ExecuteOutput, Verify } from "../../test.ts";
import { axeSmokeTest, find, pageModes, readFindings } from "./shared.ts";

const matrixEarnsItsCost: Verify = {
  name: "the theme and viewport axes each find something the other cannot",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();

    // reached by emulating prefers-color-scheme: author CSS media query
    const darkOnly = find(findings, "color-contrast :: #555555 on #333333");
    assertEquals(darkOnly.themes, ["dark"]);
    assertEquals(darkOnly.viewports, ["1440x900", "390x844"]);

    const mobileOnly = find(findings, "color-contrast :: #f8f8f8 on #f0f0f0");
    assertEquals(mobileOnly.viewports, ["390x844"]);
    assertEquals(mobileOnly.themes, ["dark", "light"]);

    return Promise.resolve();
  },
};

const quartoDarkThemeIsReached: Verify = {
  name: "the Quarto dark theme is selected, not just emulated",
  verify: (_output: ExecuteOutput[]) => {
    // This failure lives in darkly's own palette, so it is unreachable by
    // prefers-color-scheme emulation: the fixture leaves
    // respect-user-color-scheme at its default of false. Only seeding
    // localStorage["quarto-color-scheme"] = "alternate" before navigation
    // selects the theme, which is why this assertion is the one that would
    // fail if mode selection regressed.
    const { findings } = readFindings();
    const themeOnly = find(findings, "color-contrast :: #6c757d on #222222");
    assertEquals(themeOnly.themes, ["dark"]);
    assertEquals(themeOnly.pages, ["theme.html"]);
    assertEquals(themeOnly.impact, "serious");
    return Promise.resolve();
  },
};

const everyPageDiscoversTwoModes: Verify = {
  name: "every page here discovers the light/dark pair, and scans both",
  verify: (_output: ExecuteOutput[]) => {
    // The site sets `theme: {light, dark}` site-wide, so discovery must find
    // the before-body script marker on every page. A `default` entry here
    // would mean a dark cell silently vanished from the matrix.
    const results = readFindings();
    for (const [page, modes] of Object.entries(pageModes())) {
      assertEquals(modes, ["light", "dark"], `wrong modes for ${page}`);
    }
    assertEquals(
      results.cells.total,
      results.pages.length * results.config.viewports.length * 2,
    );
    return Promise.resolve();
  },
};

axeSmokeTest(
  "matrix",
  "quarto call axe (matrix: viewport and theme axes)",
  [matrixEarnsItsCost, quartoDarkThemeIsReached, everyPageDiscoversTwoModes],
);
