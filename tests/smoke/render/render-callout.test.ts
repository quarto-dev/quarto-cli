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
    // callout environments are created
    "div.callout-warning",
    "div.callout-important",
    "div.callout-note",
    "div.callout-tip",
    "div.callout-caution",
    "div.callout.no-icon",
    // formatting is kept in caption
    "div.callout-tip > div.callout-header > div.callout-caption-container > strong",
    "div.callout-tip > div.callout-header > div.callout-caption-container > code"
  ]),
]);

const teXOutput = outputForInput(input, "latex");
testRender(input, "latex", true, [
  ensureFileRegexMatches(teXOutput.outputPath, [
    requireLatexPackage("fontawesome5"),
    requireLatexPackage("tcolorbox", "many"),
    // callout environments are created
    /quarto-callout-warning/,
    /quarto-callout-important/,
    /quarto-callout-note/,
    /quarto-callout-tip/,
    /quarto-callout-caution/,
    // formatting is kept in caption,
    /{Caption with \\textbf{formatted} text, like \\texttt{function\\_name\(\)}/,
  ]),
]);

const docXoutput = outputForInput(input, "docx");
testRender(input, "docx", true, [
  ensureDocxRegexMatches(docXoutput.outputPath, [
    // callout environments are created
    /<pic:cNvPr.*warning\.png".*?\/>/,
    /<pic:cNvPr.*important\.png".*?\/>/,
    /<pic:cNvPr.*note\.png".*?\/>/,
    /<pic:cNvPr.*tip\.png".*?\/>/,
    /<pic:cNvPr.*caution\.png".*?\/>/,
    // formatting is kept in caption,
    /Caption with.*<w:bCs.*formatted.*text, like.*<w:rStyle w:val="VerbatimChar".*function_name\(\)/
  ]),
]);
