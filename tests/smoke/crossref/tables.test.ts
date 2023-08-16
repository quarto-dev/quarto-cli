/*
 * tables.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { renderVerifyLatexOutput, testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";
import { docs } from "../../utils.ts";

/* HTML */

const tablesQmd = crossref("tables.qmd", "html");
testRender(tablesQmd.input, "html", false, [
  ensureHtmlElements(tablesQmd.output.outputPath, [
    // tables in figure elements
    "section#simple-crossref-table > div#tbl-letters > figure table",
    "section#sub-tables div.quarto-layout-panel > figure div.quarto-layout-row div#tbl-first > figure table",
    "section#sub-tables div.quarto-layout-panel > figure div.quarto-layout-row div#tbl-second > figure table",

    // table captions in figure elements (with and without subfloats)
    "section#simple-crossref-table > div#tbl-letters > figure.quarto-float-tbl > figcaption.table.quarto-float-caption",
    "section#sub-tables div#tbl-panel.quarto-layout-panel > figure.quarto-float-tbl > figcaption.table.quarto-float-caption",
    "section#sub-tables div.quarto-layout-panel div.quarto-layout-row div#tbl-first  > figure.quarto-float-tbl > figcaption.table.quarto-subfloat-caption",
    "section#sub-tables div.quarto-layout-panel div.quarto-layout-row div#tbl-second > figure.quarto-float-tbl > figcaption.table.quarto-subfloat-caption",
  ]),
  ensureFileRegexMatches(tablesQmd.output.outputPath, [
    /Table&nbsp;1: My Caption/,
    /Table&nbsp;2: Main Caption/,
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
    "div.quarto-layout-panel div.quarto-layout-row div#tbl-cars > figure.quarto-float-tbl >figcaption.table.quarto-subfloat-caption",
    "div.quarto-layout-panel div.quarto-layout-row div#tbl-pressure > figure.quarto-float-tbl > figcaption.table.quarto-subfloat-caption",
  ]),
  ensureFileRegexMatches(knitrTablesQmd.output.outputPath, [
    /Table&nbsp;1: Tables/,
    /Table&nbsp;1 \(a\)/,
    /\(a\) Cars/,
    /\(b\) Pressure/,
  ], [
    /\?@tbl-/,
  ]),
]);

/* LaTeX */

/* caption is inserted in the right place in table environment*/
renderVerifyLatexOutput(docs("crossrefs/knitr-tables-latex.qmd"), [
  /\\begin{table}.*\\caption{\\label{tbl-1}.*}.*\\begin{longtable}\[.*\]{.*}.*\\end{longtable}/s,
  /\\begin{table}.*\\caption{\\label{tbl-2}.*}.*\\centering.*\\begin{tabular}{.*}/s,
  /\\begin{table}.*\\caption{\\label{tbl-3}.*}.*\\centering.*\\begin{longtable\*}{.*}/s,
  /\\begin{table}.*\\caption{\\label{tbl-4}.*}.*\\centering\n\\begin{tabular}\[c\]{.*}/s,
]);
