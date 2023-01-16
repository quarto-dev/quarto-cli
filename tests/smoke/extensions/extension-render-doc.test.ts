/*
* extension-render-doc.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const input = docs("extensions/basic/shortcodes.qmd");
const htmlOutput = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureHtmlElements(htmlOutput.outputPath, [
    // callout environments are created
    "i.fa-regular.fa-heart",
    "i.fa-solid.fa-heart",
  ], [
    "script[src='shortcodes_files/libs/quarto-contrib/glightbox/glightbox.min.js']",
  ]),
]);

const filterInput = docs("extensions/basic/filter.qmd");
const filterOutput = outputForInput(filterInput, "html");
testRender(filterInput, "html", false, [
  ensureHtmlElements(filterOutput.outputPath, [
    // callout environments are created
    "a.lightbox",
  ]),
]);

const formatInput = docs("extensions/basic/format.qmd");
testRender(formatInput, "jss-html", false);

const revealInput = docs("extensions/lexcorp/lexcorp.qmd");
const revealOutput = outputForInput(revealInput, "html");
testRender(revealInput, "lexcorp-revealjs", false, [
  ensureHtmlElements(revealOutput.outputPath, [
    "img[src='_extensions/lexcorp/logo.png']",
  ]),
]);
