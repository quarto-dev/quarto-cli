/*
* include-fixups.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

/* Disable test for temporarily removed feature.

import { ensureHtmlSelectorSatisfies } from "../../verify.ts";

import { testRender } from "../render/render.ts";

import { fileLoader } from "../../utils.ts";
import { Element } from "../../../src/core/deno-dom.ts";
import * as ld from "../../../src/core/lodash.ts";

const directives = fileLoader("directives");

const test1 = directives("include/test1/index.qmd", "html");
testRender(test1.input, "html", false, [
  ensureHtmlSelectorSatisfies(test1.output.outputPath, "a", (nodeList) => {
    const nodes = Array.from(nodeList);
    const targets = nodes.map((node) => (node as Element).getAttribute("href"));
    return ld.isEqual(targets, [
      "sub/../link.qmd",
      "sub/sub/../link.qmd",
      "sub/sub/../link.qmd",
      "../link.qmd",
      "sub/../link.qmd",
      "sub/sub/../link.qmd",
      "sub/sub/../link.qmd",
      "../link.qmd",
      "../link.qmd",
      "../link.qmd",
      "sub/sub/../link.qmd",
      "../link.qmd",
    ]);
  }),
]);*/
