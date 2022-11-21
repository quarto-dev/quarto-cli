/*
* theorems.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";

import { crossref } from "./utils.ts";

const therQmd = crossref("theorems.qmd", "html");
testRender(therQmd.input, "html", false, [
  ensureHtmlElements(therQmd.output.outputPath, [
    "div#thm-line span.theorem-title",
  ]),
  ensureFileRegexMatches(therQmd.output.outputPath, [
    /Theorem&nbsp;1/,
    /Theorem 1 \(Line\)/,
  ], [
    /\?@thm-/,
  ]),
]);

// Build the set of matches and no matches for the various types
const types = [
  ["Lemma", "lem"],
  ["Corollary", "cor"],
  ["Proposition", "prp"],
  ["Conjecture", "cnj"],
  ["Definition", "def"],
  ["Example", "exm"],
  ["Exercise", "exr"],
];
const selectors = types.map((type) => {
  return `div#${type[1]}-test span.theorem-title`;
});
const matches: RegExp[] = [];
types.forEach((type) => {
  matches.push(RegExp(`${type[0]}&nbsp;1`));
  matches.push(RegExp(`${type[0]} 1 \\(${type[0]}\\)`));
  matches.push(RegExp(`${type[0]}&nbsp;1`));
});
const noMatches = types.map((type) => {
  return RegExp(`\\?${type[1]}-`);
});

const therTypesQmd = crossref("theorem-types.qmd", "html");
testRender(therTypesQmd.input, "html", false, [
  ensureHtmlElements(therTypesQmd.output.outputPath, selectors),
  ensureFileRegexMatches(therTypesQmd.output.outputPath, matches, noMatches),
]);
