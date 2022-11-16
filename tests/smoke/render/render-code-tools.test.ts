/*
* render-r.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { fileLoader } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

let doc = fileLoader("code-tools")(
  "code-tools-activated.qmd",
  "html",
);
testRender(doc.input, "html", false, [
  ensureHtmlElements(doc.output.outputPath, [
    "div.quarto-title-block button#quarto-code-tools-source",
    "div#quarto-embedded-source-code-modal",
  ]),
]);

doc = fileLoader("code-tools")("code-tools-toggle.qmd", "html");
testRender(doc.input, "html", false, [
  ensureHtmlElements(doc.output.outputPath, [
    "div.quarto-title-block button#quarto-code-tools-menu",
    "div.cell > details",
  ]),
]);

doc = fileLoader("code-tools")("code-tools-external-source.qmd", "html");
testRender(doc.input, "html", false, [
  ensureHtmlElements(doc.output.outputPath, [
    "div.quarto-title-block button#quarto-code-tools-source[data-quarto-source-url]",
  ]),
]);