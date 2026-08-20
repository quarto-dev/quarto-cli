/*
 * axe-matrix.test.ts
 *
 * `quarto dev-call axe` against tests/docs/axe-scan/sites/matrix: the two axes
 * that justify scanning every page four times.
 *
 * Every planted failure on that site is conditional, and each is reachable by
 * exactly one route — a narrow viewport, an emulated colour-scheme preference,
 * or Quarto's own colour-scheme toggle. A cell that took the wrong route
 * therefore fails an assertion here rather than quietly reporting a duplicate.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { ExecuteOutput, Verify } from "../../test.ts";
import {
  axeSmokeTest,
  countColorSchemes,
  find,
  readFindings,
} from "./shared.ts";

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
    // respect-user-color-scheme at its default of false. Only driving Quarto's
    // colour-scheme toggle selects the theme, which is why this assertion is
    // the one that would fail if the toggle handling regressed.
    const { findings } = readFindings();
    const themeOnly = find(findings, "color-contrast :: #6c757d on #222222");
    assertEquals(themeOnly.themes, ["dark"]);
    assertEquals(themeOnly.pages, ["theme.html"]);
    assertEquals(themeOnly.impact, "serious");
    return Promise.resolve();
  },
};

const colorSchemeRoutesRecorded: Verify = {
  name: "each cell records how it reached its theme, and none is unreachable",
  verify: (_output: ExecuteOutput[]) => {
    const routes = countColorSchemes();
    const seen = JSON.stringify(routes);

    // Every page here is Quarto output with a dark theme, so every cell must
    // have reached the theme it claims.
    assertEquals(routes["unreachable"] ?? 0, 0, `unreachable cells: ${seen}`);

    // The toggle must actually have been driven: if this is 0 the scanner fell
    // back to emulation everywhere and the dark cells are light ones.
    assert((routes["toggled"] ?? 0) > 0, `toggle never driven: ${seen}`);

    // And nothing reused a sibling. Reuse is correct only where there is no
    // dark theme to select; here it would mean a dark cell was never scanned.
    assertEquals(
      routes["assumed-identical"] ?? 0,
      0,
      `cells reused a sibling despite a dark theme: ${seen}`,
    );

    return Promise.resolve();
  },
};

axeSmokeTest(
  "matrix",
  "quarto dev-call axe (matrix: viewport and theme axes)",
  [matrixEarnsItsCost, quartoDarkThemeIsReached, colorSchemeRoutesRecorded],
);
