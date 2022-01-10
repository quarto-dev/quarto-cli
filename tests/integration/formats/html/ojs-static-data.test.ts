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

// this appeases the TypeScript typechecker
// who doesn't like what it sees inside the inPuppeteer closures
// deno-lint-ignore no-explicit-any no-unused-vars
const window = (undefined as any);


const filename = "docs/ojs/test-ojs-static-data.qmd";
testRender(filename, "html", false, [
  verifyOjsValue(localFileURL(filename), "v2", 6.9),
], {
  teardown: () => {
    Deno.removeSync("docs/ojs/iris.csv");
    return Promise.resolve();
  },
});

