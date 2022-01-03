/*
* render-r.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs } from "../../utils.ts";
import { fileExists } from "../../verify.ts";
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
