/*
* render-r.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs, fileLoader } from "../../utils.ts";
import { ensureHtmlSelectorSatisfies, fileExists } from "../../verify.ts";
import { testRender } from "./render.ts";

const plotPath = "docs/test_files/figure-html";

testRender(docs("test.Rmd"), "html", false, [
  fileExists(plotPath),
], {
  teardown: () => {
    return Deno.remove(plotPath, { recursive: true });
  },
});

testRender(docs("test.Rmd"), "html", false, [
  fileExists(plotPath),
], {
  teardown: () => {
    return Deno.remove(plotPath, { recursive: true });
  },
}, ["--execute-params", "docs/params.yml"]);

const knitrOptions = fileLoader()("test-knitr-options.qmd", "html");
testRender(knitrOptions.input, "html", false, [
  ensureHtmlSelectorSatisfies(
    knitrOptions.output.outputPath,
    "#comment-empty code",
    (nodeList) => {
      return /\n\[1\] 3/.test(nodeList[0].textContent);
    },
  ),
  ensureHtmlSelectorSatisfies(
    knitrOptions.output.outputPath,
    "#comment-change code",
    (nodeList) => {
      return /\n\$ \[1\] 3/.test(nodeList[0].textContent);
    },
  ),
  ensureHtmlSelectorSatisfies(
    knitrOptions.output.outputPath,
    "#prompt code.sourceCode",
    (nodeList) => {
      return Array.from(nodeList).every((e) => /^>/.test(e.textContent));
    },
  ),
  ensureHtmlSelectorSatisfies(
    knitrOptions.output.outputPath,
    "#no-prompt code.sourceCode",
    (nodeList) => {
      return Array.from(nodeList).every((e) => /^[^>]/.test(e.textContent));
    },
  ),
]);

const sqlEngine = fileLoader()("test-knitr-sql.qmd", "html");
testRender(sqlEngine.input, "html", false);
