/*
* pagebreak.test.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { ensureHtmlSelectorSatisfies } from "../../verify.ts";

import { renderVerifyLatexOutput, testRender } from "../render/render.ts";

import { fileLoader } from "../../utils.ts";
import { Element } from "../../../src/core/deno-dom.ts";
import { dirAndStem } from "../../../src/core/path.ts";

const directives = fileLoader("directives");

const test1 = directives("pagebreak/minimal.qmd", "html");
testRender(test1.input, "html", false, [
  ensureHtmlSelectorSatisfies(test1.output.outputPath, "div", (nodeList) => {
    const nodes = Array.from(nodeList);

    return nodes.filter((node) =>
      (node as Element).getAttribute("style") === "page-break-after: always;"
    ).length === 2;
  }),
], {
  teardown: () => {
    const [dir, stem] = dirAndStem(test1.input);
    Deno.removeSync(join(dir, `${stem}.md`));
    return Promise.resolve();
  },
});

const test2 = directives("pagebreak/one-break.qmd", "latex");
renderVerifyLatexOutput(test2.input, [/\\pagebreak/]);

const test3 = directives("pagebreak/one-raw-break.qmd", "latex");
renderVerifyLatexOutput(test3.input, [/\\pagebreak/]);
