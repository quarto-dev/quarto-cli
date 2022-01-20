/*
* latex.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const allQmd = crossref("all.qmd", "latex");

const simpleFigRegexes = [
  /\\begin{figure}[^]*?\\caption{\\label{fig-elephant}[^]*?\\end{figure}/,
  /fig\.~\\ref{fig-elephant}/,
];
const subFigRegexes = [
  /\\begin{figure}[^]*?\\subcaption{\\label{fig-surus}Surus}[^]*?\\subcaption{\\label{fig-abbas}Abbas}[^]*?\\end{figure}/,
  /fig\.~\\ref{fig-elephants}/,
  /fig\.~\\ref{fig-abbas}/,
];

const simpleTableRegexes = [
  /\\begin{longtable}[^]*?\\caption{\\label{tbl-letters}[^]*?\\end{longtable}/,
  /tbl\.~\\ref{tbl-letters}/,
];
const subTableRegexes = [
  /\\begin{table}[^]*?\\subcaption{\\label{tbl-first}First Table}[^]*?\\subcaption{\\label{tbl-second}Second Table}[^]*?\\end{table}/,
  /tbl\.~\\ref{tbl-panel}/,
  /tbl\.~\\ref{tbl-second}/,
];

const theoremRegexes = [
  /\\begin{theorem}[^]*?\\label{thm-line}[^]*?\\end{theorem}/,
  /thm\.~\\ref{thm-line}/,
];

testRender(allQmd.input, "latex", true, [
  ensureFileRegexMatches(allQmd.output.outputPath, [
    ...simpleFigRegexes,
    ...subFigRegexes,
    ...simpleTableRegexes,
    ...subTableRegexes,
    ...theoremRegexes,
  ]),
]);
