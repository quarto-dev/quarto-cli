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
    "#chunk-below > p + img.r-stretch + p.caption + div.cell",
    "#no-caption > p + img.r-stretch",
    "#height-defined img:not(.r-stretch)",
    "#rigth-aligned > p + img.r-stretch.quarto-figure-right",
    "#only-image > img.r-stretch + p.caption",
    "#alt-text > img.r-stretch[alt]",
    "#caption-title > img.r-stretch[title] + p.caption",
    "#with-class-no-caption > img.stretch",
    "#with-class-caption > img.stretch.quarto-figure-center + p.caption",
    "#knitr-plot > div.cell + img.r-stretch + p.caption",
    "#knitr-plot-no-echo > img.r-stretch + p.caption",
    "#knitr-and-text > img.r-stretch + p.caption + p",
    "#knitr-align > img.r-stretch.quarto-figure-right + p.caption",
    "#knitr-no-caption-and-content > img.r-stretch + div.cell",
    "#no-content > img.r-stretch",
    "#no-content-caption > img.r-stretch + p.caption",
  ], [
    "#columns img.r-stretch",
    "#more-than-one img.r-stretch",
    "section#no-stretch-class.nostretch img.r-stretch",
    "#knitr-height img.r-stretch",
    "#knitr-height-pct img.r-stretch",
    "#inline-image img.r-stretch",
    "#block-layout img.r-stretch",
    "#block-layout2 img.r-stretch",
    "#fig-tab-layout img.r-stretch",
  ]),
]);
