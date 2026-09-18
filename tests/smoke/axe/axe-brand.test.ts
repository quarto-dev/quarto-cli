/*
 * axe-brand.test.ts
 *
 * `quarto call axe` against tests/docs/axe-scan/sites/brand-light-only: a
 * real `_brand.yml` with light values only.
 *
 * Quarto answers such a brand with `quarto-color-scheme` links tagged
 * `data-mode="light"` — one of them a `quarto-color-alternate` pointing at a
 * dark Bootstrap build — but no before-body script, because there is no dark
 * mode behind them. A probe that asks for `[data-mode]`, or for the alternate
 * class, reads that markup as "there is a dark theme" and scans both themes
 * for nothing. Found on a live brand.yml site, 2026-08-20. Mode discovery must
 * read the script marker instead, and give each page one `default` cell.
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
  cellNames,
  find,
  pageModes,
  readCell,
  readFindings,
} from "./shared.ts";

const lightOnlyBrandIsOneMode: Verify = {
  name: "light-only colour-scheme links do not count as a dark theme",
  verify: (_output: ExecuteOutput[]) => {
    // One mode per page, one cell per page x viewport — never a light/dark
    // pair scanned twice for nothing.
    const results = readFindings();
    for (const [page, modes] of Object.entries(pageModes())) {
      assertEquals(modes, ["default"], `wrong modes for ${page}`);
    }
    assertEquals(
      results.cells.total,
      results.pages.length * results.config.viewports.length,
    );
    assertEquals(
      cellNames(),
      [
        "index__1440x900__default",
        "index__320x568__default",
      ].sort(),
    );

    // And the links measuring light means no dark-coloured annotation either.
    const cell = readCell("index__1440x900__default");
    assertEquals(cell.darkColoured, undefined);

    return Promise.resolve();
  },
};

const defaultCellStillReports: Verify = {
  name: "the single default cell carries the page's findings",
  verify: (_output: ExecuteOutput[]) => {
    // One cell is a discovery about the page, not dropped coverage: the
    // planted button must still be reported, against the `default` mode.
    const { findings } = readFindings();
    const button = find(findings, "button-name :: button");
    assertEquals(button.impact, "critical");
    assertEquals(button.themes, ["default"]);
    assertEquals(button.pages, ["index.html"]);
    assert(
      readCell("index__1440x900__default").result!.violations.length > 0,
      "the default cell found nothing, so the comparison proves nothing",
    );
    return Promise.resolve();
  },
};

axeSmokeTest(
  "brand-light-only",
  "quarto call axe (light-only _brand.yml)",
  [lightOnlyBrandIsOneMode, defaultCellStillReports],
);
