/*
 * axe-darkly.test.ts
 *
 * `quarto call axe` against tests/docs/axe-scan/sites/darkly: a site whose
 * only theme is dark-coloured.
 *
 * `theme: darkly` ships one presentation, so discovery must give each page one
 * cell — labelled `default`, never `dark` — while the measured colour (the
 * sole bootstrap link's `data-mode="dark"`) is surfaced as an annotation in
 * the cell payload and a note on the console.
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

const oneDarkColouredMode: Verify = {
  name: "a dark-coloured single theme is one default cell, annotated",
  verify: (output: ExecuteOutput[]) => {
    for (const [page, modes] of Object.entries(pageModes())) {
      assertEquals(modes, ["default"], `wrong modes for ${page}`);
    }
    assertEquals(
      cellNames(),
      [
        "index__1440x900__default",
        "index__390x844__default",
      ].sort(),
    );

    // The colour is an annotation — in the payload and on the console — and
    // never part of the cell's name.
    const cell = readCell("index__1440x900__default");
    assertEquals(cell.darkColoured, true);
    assert(
      output.some((line) => /dark-coloured.*index\.html/.test(line.msg)),
      "the dark-coloured console note was not printed",
    );

    return Promise.resolve();
  },
};

const defaultCellStillReports: Verify = {
  name: "the single default cell carries the page's findings",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();
    const button = find(findings, "button-name :: button");
    assertEquals(button.impact, "critical");
    assertEquals(button.themes, ["default"]);
    assertEquals(button.pages, ["index.html"]);
    return Promise.resolve();
  },
};

axeSmokeTest(
  "darkly",
  "quarto call axe (darkly: a dark-coloured single theme)",
  [oneDarkColouredMode, defaultCellStillReports],
);
