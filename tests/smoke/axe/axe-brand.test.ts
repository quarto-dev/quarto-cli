/*
 * axe-brand.test.ts
 *
 * `quarto dev-call axe` against tests/docs/axe-scan/sites/brand-light-only: a
 * real `_brand.yml` with light values only.
 *
 * Quarto answers such a brand with `quarto-color-scheme` links tagged
 * `data-mode="light"` — one of them a `quarto-color-alternate` pointing at a
 * dark Bootstrap build — and no colour-scheme toggle. A probe that asks for
 * `[data-mode]`, or for the alternate class, reads that as "there is a dark
 * theme", scans both themes for nothing, and reports duplicate coverage as if
 * it were real. Found on a live brand.yml site, 2026-08-20.
 *
 * The site is here rather than a hand-written page because the markup belongs
 * to Quarto: a mock would keep passing after Quarto changed it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { ExecuteOutput, Verify } from "../../test.ts";
import {
  axeSmokeTest,
  countColorSchemes,
  find,
  readCell,
  readFindings,
} from "./shared.ts";

const lightOnlyBrandIsNotADarkTheme: Verify = {
  name: "light-only colour-scheme links do not count as a dark theme",
  verify: (_output: ExecuteOutput[]) => {
    const light = readCell("index__1440x900__light");
    const dark = readCell("index__1440x900__dark");
    assertEquals(light.colorScheme, "emulated");
    assertEquals(dark.colorScheme, "assumed-identical");

    // Reuse carried the payload rather than an empty result — an empty one
    // would look the same as a clean page.
    assert(
      light.result!.violations.length > 0,
      "the light cell found nothing, so reuse proves nothing",
    );
    assertEquals(
      dark.result!.violations.length,
      light.result!.violations.length,
    );

    // Half the matrix reused, and nothing was scanned twice for one theme.
    const routes = countColorSchemes();
    const seen = JSON.stringify(routes);
    assertEquals(routes["toggled"] ?? 0, 0, `a toggle was driven: ${seen}`);
    assertEquals(
      routes["assumed-identical"] ?? 0,
      2,
      `expected both dark cells to reuse: ${seen}`,
    );

    return Promise.resolve();
  },
};

const reusedCellsStillReport: Verify = {
  name: "a reused cell contributes its findings to both themes",
  verify: (_output: ExecuteOutput[]) => {
    // Reuse is an assumption about the theme, not a reason to drop coverage:
    // the planted button must be reported against dark as well as light.
    const { findings } = readFindings();
    const button = find(findings, "button-name :: button");
    assertEquals(button.impact, "critical");
    assertEquals(button.themes, ["dark", "light"]);
    assertEquals(button.pages, ["index.html"]);
    return Promise.resolve();
  },
};

axeSmokeTest(
  "brand-light-only",
  "quarto dev-call axe (light-only _brand.yml)",
  [lightOnlyBrandIsNotADarkTheme, reusedCellsStillReport],
);
