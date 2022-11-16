/*
* latex.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureDocxRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const allQmd = crossref("all-docx.qmd", "docx");

function bookmarkStart(name: string) {
  return RegExp(
    `<w:bookmarkStart[\\s]*w:id="[0-9]+"[\\s]*w:name="${name}"[\\s]*\\/>`,
  );
}

function anchor(name: string) {
  return RegExp(
    `<w:hyperlink w:anchor="${name}">`,
  );
}

function text(text: string) {
  return RegExp(
    `>${text}<`,
  );
}

const simpleFigRegexes = [
  bookmarkStart("fig-elephant"),
  anchor("fig-elephant"),
  // These tests no longer pass after we started introducing non-breaking
  // spaces between 'Figure' and '1' (although upon cracking the file
  // it seems like there are no non-breaking spaces and these strings
  // are in fact in the file)
  text("Figure\\u00A01: Elephant"),
  text("Figure\\u00A01"),
];

const tableRegexes = [
  bookmarkStart("tbl-letters"),
  anchor("tbl-letters"),
  // (see comment above re: non-breaking spaces)
  text("Table\\u00A01: My Caption"),
];

const mathRegexes = [
  text("Theorem 1 \\(Line\\)"),
  bookmarkStart("thm-line"),
  anchor("thm-line"),
];

const _subTableRegexes = [
  bookmarkStart("tbl-first"),
  bookmarkStart("tbl-second"),
  anchor("tbl-first"),
  anchor("tbl-second"),
  text("Table 2: Main Caption"),
  text("(a) First Table"),
  text("(b) Second Table"),
];

const _subFigRegexes = [
  bookmarkStart("fig-elephants"),
  bookmarkStart("fig-abbas"),
  bookmarkStart("fig-surus"),
  anchor("fig-elephants"),
  anchor("fig-abbas"),
  anchor("fig-surus"),
  text("Figure 2: Famous Elephants"),
  text("Figure 2"),
  text("Figure 2 (b)"),
];

testRender(allQmd.input, "docx", true, [
  ensureDocxRegexMatches(allQmd.output.outputPath, [
    ...simpleFigRegexes,
    ...tableRegexes,
    ...mathRegexes,
    //    ...subFigRegexes,
    //    ...subTableRegexes,
  ]),
]);
