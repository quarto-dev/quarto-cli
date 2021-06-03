/*
* render-r.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { fileExists, hasSupportingFiles, outputCreated } from "./verify.ts";
import { testRender } from "./render.ts";

const plotPath = "docs/test_files/figure-html/unnamed-chunk-2-1.png";
testRender("docs/test.Rmd", "html", [
  outputCreated,
  hasSupportingFiles,
  fileExists(plotPath),
], () => {
  return Promise.resolve();
}, () => {
  return Deno.remove(plotPath);
});

testRender("docs/test.Rmd", "html", [
  outputCreated,
  hasSupportingFiles,
  fileExists(plotPath),
], () => {
  return Promise.resolve();
}, () => {
  return Deno.remove(plotPath);
}, ["--execute-params", "docs/params.yml"]);
