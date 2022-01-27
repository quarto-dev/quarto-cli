/*
* options.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const optionsQmd = crossref("options.qmd", "html");
testRender(optionsQmd.input, "html", false, [
  ensureHtmlElements(optionsQmd.output.outputPath, [], [
    "section#introduction p a",
    "section#introduction div#tbl-letters p a",
  ]),
  ensureFileRegexMatches(optionsQmd.output.outputPath, [
    /F\.&nbsp;1/,
    /T\.&nbsp;1/,
    /Figure 1— Elephant/,
    /Table 1— My Caption/,
  ], [
    /\?@fig-/,
    /\?@tbl-/,
  ]),
]);

const numberingQmd = crossref("numbering.qmd", "html");
testRender(numberingQmd.input, "html", false, [
  ensureFileRegexMatches(numberingQmd.output.outputPath, [
    /Figure&nbsp;x/,
    /Table&nbsp;A/,
    /Figure x: Elephant/,
    /Table A: My Caption/,
    /Figure y: Famous Elephants/,
    /\(i\) Surus/,
    /\(ii\) Abbas/,
  ], [
    /\?@fig-/,
    /\?@tbl-/,
  ]),
]);
