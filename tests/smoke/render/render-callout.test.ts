/*
* render-callout.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
    "div.callout-tip > div.callout-header > div.callout-title-container > strong",
    "div.callout-tip > div.callout-header > div.callout-title-container > code",
    // appearance correctly modify structure
    "#appearance div.callout-style-simple > div.callout-body > div.callout-icon-container + div.callout-body-container",
    "#appearance div.callout-style-default.callout-titled > div.callout-header > div.callout-icon-container + div.callout-title-container",
    "#appearance div.callout-style-default.callout-titled > div.callout-header + div.callout-body-container",
    "#appearance div.callout-style-default.no-icon.callout-titled > div.callout-header > div.callout-icon-container > i.no-icon",
    "#appearance div.callout-style-default.no-icon.callout-titled > div.callout-header > div.callout-icon-container + div.callout-title-container",
    "#appearance div.callout-style-simple.no-icon > div.callout-body",
    "#minimal div.callout-style-simple.no-icon > div.callout-body",
  ], 
  [
    "#appearance div.callout-style-simple.no-icon > div.callout-header",
    "#minimal div.callout-style-simple.no-icon > div.callout-header"
  ]),
]);

testRender(input, "revealjs", false, [
  ensureHtmlElements(htmlOutput.outputPath, [
    // callout environments are created
    "div.callout-warning",
    "div.callout-important",
    "div.callout-note",
    "div.callout-tip",
    "div.callout-caution",
    "div.callout.no-icon",
    // formatting is kept in caption
    "#markup div.callout-tip > div.callout-body > div.callout-title strong > code",
    "#markup div.callout-caution > div.callout-body > div.callout-content code",
    "#markup div.callout-none.no-icon.callout-titled.callout-style-simple > div.callout-body > div.callout-content code",
    // appearance correctly modify structure
    "#overview div.callout-style-default.callout-titled > div.callout-body > div.callout-title > div.callout-icon-container + p > strong", // default: title and icon correctly set
    "#overview div.callout-style-default.callout-titled > div.callout-body > div.callout-title + div.callout-content", // default: title and content correctly set
    "#appearance div.callout-style-simple > div.callout-body > div.callout-icon-container + div.callout-content", // simple: icon and content correctly set
    "#appearance div.callout-style-default.callout-titled > div.callout-body > div.callout-title + div.callout-content", // default: title and content correctly set
    "#appearance div.callout-style-default.no-icon.callout-titled > div.callout-body > div.callout-title + div.callout-content", // default no icon: title and content correctly set
    "#appearance div.callout-style-simple.no-icon > div.callout-body", // simple no icon: content correctly set
    "#minimal div.callout-style-simple.no-icon > div.callout-body > div.callout-content", // minimal
  ], 
  [
    "#appearance div.callout-style-default.no-icon.callout-titled > div.callout-body > div.callout-title > div.callout-icon-container", // default no icon: title and content correctly set
    "#appearance div.callout-style-simple.no-icon > div.callout-body > div.callout-icon-container", // simple no icon
    "#minimal div.callout-style-simple.no-icon > div.callout-body > div.callout-icon-container"
  ]),
]);

const teXOutput = outputForInput(input, "latex");
testRender(input, "latex", true, [
  ensureFileRegexMatches(teXOutput.outputPath, [
    requireLatexPackage("fontawesome5"),
    requireLatexPackage("tcolorbox", "skins,breakable"),
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
    /Caption with.*<w:bCs.*formatted.*text, like.*<w:rStyle w:val="VerbatimChar".*function_name\(\)/,
  ]),
]);

const crossRefInput = docs("crossrefs/callouts.qmd");
const crossRefOutput = outputForInput(crossRefInput, "latex");
testRender(crossRefInput, "latex", true, [
  ensureFileRegexMatches(crossRefOutput.outputPath, [
    // callout environments are created
    /\\begin\{figure\}\[H\]/,
  ]),
]);
