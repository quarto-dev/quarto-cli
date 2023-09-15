/*
 * render-reveal.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { docs, fileLoader, outputForInput } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  ensureHtmlSelectorSatisfies,
} from "../../verify.ts";
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
    "#rigth-aligned > img.r-stretch.quarto-figure-right",
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
    "#custom-divs-opt-in > div.custom-block:not(.r-stretch) + img.r-stretch + p.caption",
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
    "#custom-divs-simple img.r-stretch",
    "#custom-divs-caption img.r-stretch",
    "#custom-divs-caption img.r-stretch",
    "#custom-divs-knitr img.r-stretch",
    "#custom-divs-knitr-caption img.r-stretch",
    "#aside img.r-stretch",
    "#absolute img.r-stretch",
    "#link img.r-stretch",
  ]),
]);

// fragments
const fragmentsDiv = fileLoader("reveal")("fragments.qmd", "revealjs");
testRender(fragmentsDiv.input, "revealjs", false, [
  ensureHtmlElements(fragmentsDiv.output.outputPath, [
    "#slide-2 > div.fragment > h3",
  ], []),
]);

// output-location
const outputLocation = fileLoader("reveal")("output-location.qmd", "revealjs");
testRender(outputLocation.input, "revealjs", false, [
  ensureHtmlElements(outputLocation.output.outputPath, [
    "section#loc-slide + section#loc-slide-output > div.output-location-slide",
    "section#loc-fragment > div.fragment > div.cell-output-display",
    "section#loc-col-fragment > div.columns > div.column:nth-child(2).fragment > div.cell-output-display",
  ], [
    "section#loc-slide > div.output-location-slide",
  ]),
  ensureHtmlSelectorSatisfies(
    outputLocation.output.outputPath,
    "section#loc-column > div.columns > div.column",
    (nodeList) => {
      return nodeList.length === 2;
    },
  ),
  ensureHtmlSelectorSatisfies(
    outputLocation.output.outputPath,
    "section#loc-col-fragment > div.columns > div.column",
    (nodeList) => {
      return nodeList.length === 2;
    },
  ),
]);

// reveal-config
const revealConfigs = fileLoader("reveal")("reveal-configs.qmd", "revealjs");
testRender(revealConfigs.input, "revealjs", false, [
  ensureFileRegexMatches(revealConfigs.output.outputPath, [
    "pdfSeparateFragments.*true",
    "smaller.*true",
    "pdfSeparateFragments.*true",
    'autoAnimateEasing.*"ease-in-out"',
    "autoAnimateDuration.*5",
    "autoAnimateUnmatched.*false",
    "pdfMaxPagesPerSlide.*1",
  ], []),
]);
