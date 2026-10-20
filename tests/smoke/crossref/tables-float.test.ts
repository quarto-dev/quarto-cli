/*
 * tables-float.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { docs } from "../../utils.ts";
import { ensurePdfRegexMatches } from "../../verify.ts";
import { renderVerifyLatexOutput, testRender } from "../render/render.ts";

renderVerifyLatexOutput(docs("crossrefs/tables-twocolumn.qmd"), [
  /\\begin\{table\}\[t\][^]*?\\caption\{First caption\}\\label\{tbl-first\}/,
  /\\begin\{table\}\[b\][^]*?\\caption\{Second caption\}\\label\{tbl-second\}/,
  /Table~\\ref\{tbl-first\}/,
  /Table~\\ref\{tbl-second\}/,
  /\\subcaption\{\\label\{tbl-child\}Child caption\}/,
], [
  /\\begin\{longtable\}/,
  /\\begin\{table\}(?:(?!\\end\{table\})[^])*\\begin\{table\}/,
]);

renderVerifyLatexOutput(docs("crossrefs/tables-float.qmd"), [
  /\\begin\{longtable\}[^]*?\\caption\{Default caption\}\\label\{tbl-long\}/,
  /\\begin\{table\}\[t\][^]*?\\caption\{Floating caption\}\\label\{tbl-float\}/,
  /Table~\\ref\{tbl-long\}/,
  /Table~\\ref\{tbl-float\}/,
]);

renderVerifyLatexOutput(docs("crossrefs/tables-twocolumn-list.qmd"), [
  /\\begin\{table\}[^]*?\\caption\{List caption\}\\label\{tbl-list\}/,
  /\\begin\{minipage\}[^]*?\\begin\{longtable\}/,
], [
  /\\begin\{minipage\}[^]*?\\begin\{table\}/,
]);

testRender(docs("crossrefs/tables-twocolumn.qmd"), "pdf", true, [
  ensurePdfRegexMatches(docs("crossrefs/tables-twocolumn.pdf"), [
    /Table 1: First caption/,
    /Table 2: Second caption/,
    /Table 3: Panel caption/,
    /See Table 1, Table 2, and Table 3 \(especially Table 3a\)/,
  ], [/\?\?/]),
]);
