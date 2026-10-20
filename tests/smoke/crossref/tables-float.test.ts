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
  /\\begin\{minipage\}[^]*?\\begin\{tabular\}/,
], [
  /\\begin\{longtable\}/,
  /\\begin\{minipage\}(?:(?!\\end\{minipage\})[^])*\\begin\{table\}/,
]);

testRender(docs("crossrefs/tables-twocolumn.qmd"), "pdf", true, [
  ensurePdfRegexMatches(docs("crossrefs/tables-twocolumn.pdf"), [
    /Table 1: First caption/,
    /Table 2: Second caption/,
    /Table 3: Panel caption/,
    /See Table 1, Table 2, and Table 3 \(especially Table 3a\)/,
  ], [/\?\?/]),
]);

renderVerifyLatexOutput(docs("crossrefs/tables-float-layouts.qmd"), [
  /\\begin\{table\*\}\[t\][^]*?\\end\{tabular\}[^]*?\\caption\[Short wide caption\]\{\\label\{tbl-wide\}Wide caption\}/,
  /\\multicolumn\{2\}/,
  /\\multirow\{2\}/,
  /\\real\{0\.3000\}/,
  /\\real\{0\.7000\}/,
  /Doe[^]*?2020/,
], [
  /\\begin\{longtable\}/,
  /85b77c8a-261c-4f58-9b04-f21c67e0a758/,
  /\\begin\{minipage\}(?:(?!\\end\{minipage\})[^])*\\begin\{table\}/,
]);

testRender(docs("crossrefs/tables-float-layouts.qmd"), "pdf", true, [
  ensurePdfRegexMatches(docs("crossrefs/tables-float-layouts.pdf"), [
    /Table 1: Wide caption/,
    /Table 2: Bottom caption/,
    /Table 3: After caption/,
    /See Table 1, Table 2, and Table 3/,
    /Doe[^]*?2020/,
    /Table note text\./,
  ], [/\?\?/]),
]);

testRender(docs("crossrefs/tables-float-margin.qmd"), "pdf", true, [
  ensurePdfRegexMatches(docs("crossrefs/tables-float-margin.pdf"), [
    /Table 1: Margin\s+caption/,
    /Table 2: Wide one-column caption/,
    /See Table 1 and Table 2/,
    /Bare margin/,
  ], [/\?\?/]),
]);

testRender(docs("crossrefs/tables-float-switch.qmd"), "pdf", true, [
  ensurePdfRegexMatches(docs("crossrefs/tables-float-switch.pdf"), [
    /Table 1: Switched caption/,
    /Table 2: Restored caption/,
    /See Table 1/,
    /Double-column figure/,
  ], [/\?\?/]),
]);
