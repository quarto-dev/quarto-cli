/*
* latex.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
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
  text("Figure 1: Elephant"),
  text("Figure 1"),
];

const tableRegexes = [
  bookmarkStart("tbl-letters"),
  anchor("tbl-letters"),
  text("Table 1: My Caption"),
];

const mathRegexes = [
  text("Theorem 1 \\(Line\\)"),
  bookmarkStart("thm-line"),
  anchor("thm-line"),
];

const subTableRegexes = [
  bookmarkStart("tbl-first"),
  bookmarkStart("tbl-second"),
  anchor("tbl-first"),
  anchor("tbl-second"),
  text("Table 2: Main Caption"),
  text("(a) First Table"),
  text("(b) Second Table"),
];

const subFigRegexes = [
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
