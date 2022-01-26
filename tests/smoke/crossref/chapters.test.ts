/*
* chapters.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const chaptersQmd = crossref("chapters.qmd", "html");
testRender(chaptersQmd.input, "html", false, [
  ensureHtmlElements(chaptersQmd.output.outputPath, [
    "div#fig-elephant > figure > figcaption.figure-caption",
  ]),
  ensureFileRegexMatches(chaptersQmd.output.outputPath, [
    /Figure&nbsp;1.1/,
    /Figure 1.1: Elephant/,
  ], [
    /\?@fig-/,
  ]),
]);
