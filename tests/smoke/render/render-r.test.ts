/*
* render-r.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, fileLoader, inTempDirectory } from "../../utils.ts";
import { join } from "path/mod.ts";
import { ensureHtmlElements, ensureHtmlSelectorSatisfies, fileExists } from "../../verify.ts";
import { testRender } from "./render.ts";

inTempDirectory((dir) => {
  const tempInput = join(dir, "test.Rmd");
  Deno.copyFileSync(docs("test.Rmd"), tempInput);
  const thisPlotPath = join(dir, "test_files/figure-html");

  testRender(tempInput, "html", false, [
    fileExists(thisPlotPath),
  ], {
    teardown: () => {
      return Deno.remove(dir, { recursive: true });
    },
  });
});

inTempDirectory((dir) => {
  const tempInput = join(dir, "test.Rmd");
  Deno.copyFileSync(docs("test.Rmd"), tempInput);

  const thisPlotPath = join(dir, "test_files/figure-html");
  testRender(tempInput, "html", false, [
    fileExists(thisPlotPath),
  ], {
    teardown: () => {
      return Deno.remove(dir, { recursive: true });
    },
  }, ["--execute-params", "docs/params.yml"]);
});

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


const toSpin = fileLoader()("knitr-spin.R", "html");
testRender(toSpin.input, "html", false, [
  ensureHtmlElements(
    toSpin.output.outputPath, ["#block img"]
  ),
  ensureHtmlSelectorSatisfies(
    toSpin.output.outputPath,
    "#inline code",
    (nodeList) => {
      return /^3\.14+/.test(nodeList[0].textContent);
    },
  ),
]);