/*
* render-title-block.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("doc-layout/title-block.qmd");
const htmlOutput = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureHtmlElements(htmlOutput.outputPath, [
    "div.quarto-title",
    "p.subtitle",
    "div.quarto-categories",
    "div.quarto-title-meta",
  ], []),
]);

const noneInput = docs("doc-layout/title-block-none.qmd");
const noneOutput = outputForInput(noneInput, "html");
testRender(noneInput, "html", false, [
  ensureHtmlElements(noneOutput.outputPath, [
    "p.author",
    "p.date",
    "#title-block-header",
  ], ["div.quarto-title"]),
  ensureFileRegexMatches(noneOutput.outputPath, [/Nora Jones/], [/Published/]),
]);

const bannerInput = docs("doc-layout/title-block-banner.qmd");
const bannerOutput = outputForInput(bannerInput, "html");
testRender(bannerInput, "html", false, [
  ensureHtmlElements(bannerOutput.outputPath, [
    "main.quarto-banner-title-block",
    ".quarto-title-banner .quarto-title.column-body",
    "header#title-block-header",
    ".title",
    ".quarto-categories",
  ]),
  ensureFileRegexMatches(bannerOutput.outputPath, [/Nora Jones/], [/\[true\]/]),
]);
