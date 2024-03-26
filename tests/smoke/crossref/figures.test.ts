/*
 * figures.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const simpleQmd = crossref("simple.qmd", "html");
testRender(simpleQmd.input, "html", false, [
  ensureHtmlElements(simpleQmd.output.outputPath, [
    "section#simple-figure > h2",
    "div#fig-elephant > figure > figcaption.quarto-float-fig.quarto-float-caption",
    "section#simple-sub-figure > h2",
    "section#simple-sub-figure > div.quarto-layout-panel > figure div.quarto-layout-row",
    "section#simple-sub-figure > div.quarto-layout-panel > figure > figcaption.quarto-float-fig.quarto-float-caption",
  ]),
  ensureFileRegexMatches(simpleQmd.output.outputPath, [
    /Figure&nbsp;1: Elephant/,
    /Figure&nbsp;2: Famous Elephants/,
    /\(a\) Surus/,
    /\(b\) Abbas/,
    /Figure&nbsp;1/,
    /Figure&nbsp;2/,
    /Figure&nbsp;2 \(b\)/,
  ], [
    /\?@fig-/,
  ]),
]);

const pythonQmd = crossref("python.qmd", "html");
testRender(pythonQmd.input, "html", false, [
  ensureHtmlElements(pythonQmd.output.outputPath, [
    "section#python-crossref-figure div#fig-plot > figure img.figure-img",
    "section#python-crossref-figure div#fig-plot > figure > figcaption",
  ]),
  ensureFileRegexMatches(pythonQmd.output.outputPath, [
    /Figure&nbsp;1: Plot/,
    /Figure&nbsp;1/,
  ], [
    /\?@fig-/,
  ]),
]);

const pythonSubfigQmd = crossref("python-subfig.qmd", "html");
testRender(pythonSubfigQmd.input, "html", false, [
  ensureHtmlElements(pythonSubfigQmd.output.outputPath, [
    "section#python-crossref-figure  div.quarto-layout-panel > figure div.quarto-layout-row",
    "section#python-crossref-figure  div.quarto-layout-panel > figure > figcaption.quarto-float-fig.quarto-float-caption",
    "section#python-crossref-figure  div.quarto-layout-panel > figure  img.figure-img",
  ]),
  ensureFileRegexMatches(pythonSubfigQmd.output.outputPath, [
    /Figure&nbsp;1: Plots/,
    /Figure&nbsp;1/,
    /Figure&nbsp;1 \(b\)/,
    /\(a\) Plot 1/,
    /\(b\) Plot 2/,
  ], [
    /\?@fig-/,
  ]),
]);

for (const file of ["julia.qmd", "julianative.qmd"]) {
  const juliaQmd = crossref(file, "html");
  testRender(juliaQmd.input, "html", false, [
    ensureHtmlElements(juliaQmd.output.outputPath, [
      "section#julia-crossref-figure div#fig-plot > figure img.figure-img",
      "section#julia-crossref-figure div#fig-plot > figure > figcaption",
    ]),
    ensureFileRegexMatches(juliaQmd.output.outputPath, [
      /Figure&nbsp;1: Plot/,
      /Figure&nbsp;1/,
    ], [
      /\?@fig-/,
    ]),
  ]);
}

for (const file of ["julia-subfig.qmd", "julianative-subfig.qmd"]) {
  const juliaSubfigQmd = crossref(file, "html");
  testRender(juliaSubfigQmd.input, "html", false, [
    ensureHtmlElements(juliaSubfigQmd.output.outputPath, [
      "section#julia-crossref-figure  div.quarto-layout-panel > figure div.quarto-layout-row",
      "section#julia-crossref-figure  div.quarto-layout-panel > figure > figcaption.quarto-float-fig.quarto-float-caption",
    ]),
    ensureFileRegexMatches(juliaSubfigQmd.output.outputPath, [
      /Figure&nbsp;1: Plots/,
      /Figure&nbsp;1/,
      /Figure&nbsp;1 \(b\)/,
      /\(a\) Plot 1/,
      /\(b\) Plot 2/,
    ], [
      /\?@fig-/,
    ]),
  ]);
}

const knitrQmd = crossref("knitr.qmd", "html");
testRender(knitrQmd.input, "html", false, [
  ensureHtmlElements(knitrQmd.output.outputPath, [
    "section#knitr-crossref-figure div#fig-plot > figure img.figure-img",
    "section#knitr-crossref-figure div#fig-plot > figure > figcaption",
  ]),
  ensureFileRegexMatches(knitrQmd.output.outputPath, [
    /Figure&nbsp;1: Plot/,
    /Figure&nbsp;1/,
  ], [
    /\?@fig-/,
  ]),
]);
