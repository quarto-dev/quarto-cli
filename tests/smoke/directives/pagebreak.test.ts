/*
* pagebreak.test.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ensureHtmlSelectorSatisfies } from "../../verify.ts";

import { renderVerifyLatexOutput, testRender } from "../render/render.ts";

import { fileLoader } from "../../utils.ts";
import { Element } from "../../../src/core/deno-dom.ts";

const directives = fileLoader("directives");

const test1 = directives("pagebreak/minimal.qmd", "html");
testRender(test1.input, "html", false, [
  ensureHtmlSelectorSatisfies(test1.output.outputPath, "div", (nodeList) => {
    const nodes = Array.from(nodeList);

    return nodes.filter((node) =>
      (node as Element).getAttribute("style") === "page-break-after: always;"
    ).length === 2;
  }),
]);

const test2 = directives("pagebreak/one-break.qmd", "latex");
renderVerifyLatexOutput(test2.input, [/\\pagebreak/]);

const test3 = directives("pagebreak/one-raw-break.qmd", "latex");
renderVerifyLatexOutput(test3.input, [/\\pagebreak/]);
