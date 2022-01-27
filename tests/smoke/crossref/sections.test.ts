/*
* sections.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const sectionsQmd = crossref("sections.qmd", "html");
testRender(sectionsQmd.input, "html", false, [
  ensureHtmlElements(sectionsQmd.output.outputPath, [
    "section#sec-introduction h2",
  ]),
  ensureFileRegexMatches(sectionsQmd.output.outputPath, [
    /Section&nbsp;1/,
  ], [
    /\?@sec-/,
  ]),
]);
