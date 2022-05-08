/*
* ojs-test-presence.ts
*
* test that we're adding OJS code to OJS projects, and not adding OJS
* code to projects without OJS.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { testRender } from "../../../smoke/render/render.ts";
import { localFileURL } from "../../../puppeteer.ts";
import { verifyOjsValue } from "./ojs-utils.ts";

const filename = "docs/ojs/test-ojs-static-data.qmd";
testRender(filename, "html", true, [
  verifyOjsValue(localFileURL(filename), "v2", 6.9),
], {
  teardown: () => {
    Deno.removeSync("docs/ojs/iris.csv");
    return Promise.resolve();
  },
});
