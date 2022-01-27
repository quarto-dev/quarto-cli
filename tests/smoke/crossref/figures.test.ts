/*
* figures.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const simpleQmd = crossref("simple.qmd", "html");
testRender(simpleQmd.input, "html", false, [
  ensureHtmlElements(simpleQmd.output.outputPath, [
    "section#simple-figure > h2",
    "div#fig-elephant > figure > figcaption.figure-caption",
    "section#simple-sub-figure > h2",
    "section#simple-sub-figure > div.quarto-layout-panel > figure > div.quarto-layout-row",
    "section#simple-sub-figure > div.quarto-layout-panel > figure > figcaption.figure-caption",
  ]),
  ensureFileRegexMatches(simpleQmd.output.outputPath, [
    /Figure 1: Elephant/,
    /Figure 2: Famous Elephants/,
    /\(a\) Surus/,
    /\(b\) Abbas/,
    /Figure&nbsp;1/,
    /Figure&nbsp;2/,
    /Figure&nbsp;2 \(b\)/,
  ], [
    /\?@fig-/,
  ]),
]);

if (Deno.build.os !== "windows") {
  const pythonQmd = crossref("python.qmd", "html");
  testRender(pythonQmd.input, "html", false, [
    ensureHtmlElements(pythonQmd.output.outputPath, [
      "section#python-crossref-figure div#fig-plot > figure img.figure-img",
      "section#python-crossref-figure div#fig-plot > figure > figcaption",
    ]),
    ensureFileRegexMatches(pythonQmd.output.outputPath, [
      /Figure 1: Plot/,
      /Figure&nbsp;1/,
    ], [
      /\?@fig-/,
    ]),
  ]);

  const pythonSubfigQmd = crossref("python-subfig.qmd", "html");
  testRender(pythonSubfigQmd.input, "html", false, [
    ensureHtmlElements(pythonSubfigQmd.output.outputPath, [
      "section#python-crossref-figure  div.quarto-layout-panel > figure > div.quarto-layout-row",
      "section#python-crossref-figure  div.quarto-layout-panel > figure > figcaption.figure-caption",
      "section#python-crossref-figure  div.quarto-layout-panel > figure  img.figure-img",
    ]),
    ensureFileRegexMatches(pythonSubfigQmd.output.outputPath, [
      /Figure 1: Plots/,
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
    /Figure 1: Plot/,
    /Figure&nbsp;1/,
  ], [
    /\?@fig-/,
  ]),
]);
