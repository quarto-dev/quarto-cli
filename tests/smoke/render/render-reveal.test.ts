/*
* render-reveal.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

// demo file renders ok
testRender(docs("reveal/index.qmd"), "revealjs", false);

let input = docs("reveal/aside-footnotes.qmd");
let output = outputForInput(input, "revealjs");
testRender(input, "revealjs", false, [
  ensureHtmlElements(output.outputPath, [
    // speaker notes are left not moved
    "section#slide-with-speaker-notes > aside.notes:last-child",
    // div of class aside are moved
    "section#slide-with-footnotes > aside:last-child > div > p",
    // footnotes are put in aside
    "section#slide-with-footnotes > aside:last-child > ol.aside-footnotes > li",
  ], [
    // footnotes back are removed
    "section#slide-with-footnotes > aside:last-child > ol.aside-footnotes > li > .footnote-back",
  ]),
]);

// auto-stretch feature
input = docs("reveal/stretch.qmd");
output = outputForInput(input, "revealjs");
testRender(input, "revealjs", false, [
  ensureHtmlElements(output.outputPath, [
    "#simple-image > p + img.r-stretch",
    "#chunk-below > p + img.r-stretch:has(+ p.caption + div.cell)",
  ], []),
]);
