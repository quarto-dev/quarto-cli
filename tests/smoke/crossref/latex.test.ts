/*
 * latex.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const allQmd = crossref("all.qmd", "latex");

const simpleFigRegexes = [
  /\\begin{figure}[^]*?\\caption{\\label{fig-elephant}[^]*?\\end{figure}/,
  /Figure~\\ref{fig-elephant}/,
];
const subFigRegexes = [
  /\\begin{figure}[^]*?\\subcaption{\\label{fig-surus}Surus}[^]*?\\subcaption{\\label{fig-abbas}Abbas}[^]*?\\end{figure}/,
  /Figure~\\ref{fig-elephants}/,
  /Figure~\\ref{fig-abbas}/,
];

const simpleTableRegexes = [
  /\\begin{table}[^]*?\\caption{\\label{tbl-letters}[^]*?\\begin{longtable}[^]*?\\end{longtable}/,
  /Table~\\ref{tbl-letters}/,
];
const subTableRegexes = [
  /\\begin{table}[^]*?\\subcaption{\\label{tbl-first}First Table}[^]*?\\subcaption{\\label{tbl-second}Second Table}[^]*?\\end{table}/,
  /Table~\\ref{tbl-panel}/,
  /Table~\\ref{tbl-second}/,
];

const theoremRegexes = [
  /\\begin{theorem}[^]*?\\protect\\hypertarget{thm-line}{}\\label{thm-line}[^]*?\\end{theorem}/,
  /Theorem~\\ref{thm-line}/,
];

const theoremRegexesNo = [
  /\\leavevmode\\vadjust pre{\\hypertarget{thm-line}{}}%/,
];

testRender(allQmd.input, "latex", true, [
  ensureFileRegexMatches(allQmd.output.outputPath, [
    ...simpleFigRegexes,
    ...subFigRegexes,
    ...simpleTableRegexes,
    ...subTableRegexes,
    ...theoremRegexes,
  ], [
    ...theoremRegexesNo,
  ]),
]);
