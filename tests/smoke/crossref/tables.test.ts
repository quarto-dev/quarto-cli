/*
* tables.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const tablesQmd = crossref("tables.qmd", "html");
testRender(tablesQmd.input, "html", false, [
  ensureHtmlElements(tablesQmd.output.outputPath, [
    "section#simple-crossref-table > div#tbl-letters > table > caption",
    "section#sub-tables div.quarto-layout-panel > div.quarto-layout-row > div#tbl-first > table > caption",
    "section#sub-tables div.quarto-layout-panel > div.quarto-layout-row > div#tbl-second > table > caption",
  ]),
  ensureFileRegexMatches(tablesQmd.output.outputPath, [
    /Table 1: My Caption/,
    /Table 2: Main Caption/,
    /Table&nbsp;1/,
    /Table&nbsp;2/,
    /Table&nbsp;2 \(b\)/,
    /\(a\) First Table/,
    /\(b\) Second Table/,
  ], [
    /\?@tbl-/,
  ]),
]);

const knitrTablesQmd = crossref("knitr-tables.qmd", "html");
testRender(knitrTablesQmd.input, "html", false, [
  ensureHtmlElements(knitrTablesQmd.output.outputPath, [
    "div.quarto-layout-panel > div.quarto-layout-row > div#tbl-cars > table > caption",
    "div.quarto-layout-panel > div.quarto-layout-row > div#tbl-pressure > table > caption",
  ]),
  ensureFileRegexMatches(knitrTablesQmd.output.outputPath, [
    /Table 1: Tables/,
    /Table&nbsp;1 \(a\)/,
    /\(a\) Cars/,
    /\(b\) Pressure/,
  ], [
    /\?@tbl-/,
  ]),
]);
