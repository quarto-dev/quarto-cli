/*
* options.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
    /Figure&nbsp;1— Elephant/,
    /Table&nbsp;1— My Caption/,
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
    /Figure&nbsp;x: Elephant/,
    /Table&nbsp;A: My Caption/,
    /Figure&nbsp;y: Famous Elephants/,
    /\(i\) Surus/,
    /\(ii\) Abbas/,
  ], [
    /\?@fig-/,
    /\?@tbl-/,
  ]),
]);
