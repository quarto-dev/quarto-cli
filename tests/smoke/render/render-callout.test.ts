/*
* render-callout.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import {
  ensureDocxRegexMatches,
  ensureFileRegexMatches,
  ensureHtmlElements,
  requireLatexPackage,
} from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("callouts.qmd");
const htmlOutput = outputForInput(input, "html");

testRender(input, "html", false, [
  ensureHtmlElements(htmlOutput.outputPath, [
    "div.callout-warning",
    "div.callout-important",
    "div.callout-note",
    "div.callout-tip",
    "div.callout-caution",
    "div.callout.no-icon",
  ]),
]);

const teXOutput = outputForInput(input, "latex");
testRender(input, "latex", true, [
  ensureFileRegexMatches(teXOutput.outputPath, [
    requireLatexPackage("fontawesome5"),
    requireLatexPackage("tcolorbox", "many"),
    /quarto-callout-warning/,
    /quarto-callout-important/,
    /quarto-callout-note/,
    /quarto-callout-tip/,
    /quarto-callout-caution/,
  ]),
]);

const docXoutput = outputForInput(input, "docx");
testRender(input, "docx", true, [
  ensureDocxRegexMatches(docXoutput.outputPath, [
    /<pic:cNvPr.*warning\.png".*?\/>/,
    /<pic:cNvPr.*important\.png".*?\/>/,
    /<pic:cNvPr.*note\.png".*?\/>/,
    /<pic:cNvPr.*tip\.png".*?\/>/,
    /<pic:cNvPr.*caution\.png".*?\/>/,
  ]),
]);
