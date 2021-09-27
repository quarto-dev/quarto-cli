/*
* render-r.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs } from "../../utils.ts";
import { fileExists } from "../../verify.ts";
import { testRender } from "./render.ts";

const plotPath = "docs/test_files/figure-html/unnamed-chunk-1-1.png";

testRender(docs("test.Rmd"), "html", false, [
  fileExists(plotPath),
], {
  teardown: () => {
    return Deno.remove(plotPath);
  },
});

testRender(docs("test.Rmd"), "html", false, [
  fileExists(plotPath),
], {
  teardown: () => {
    return Deno.remove(plotPath);
  },
}, ["--execute-params", "docs/params.yml"]);
