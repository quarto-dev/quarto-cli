/*
* ojs-test-presence.ts
*
* test that we're adding OJS code to OJS projects, and not adding OJS
* code to projects without OJS.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ExecuteOutput } from "../../../test.ts";
import { inPuppeteer } from "../../../puppeteer.ts";
import { assert } from "testing/asserts.ts";
import { testRender } from "../../../smoke/render/render.ts";
import { localFileURL } from "../../../puppeteer.ts";

// this appeases the TypeScript typechecker
// who doesn't like what it sees inside the inPuppeteer closures
// deno-lint-ignore no-explicit-any
const window = (undefined as any);

testRender("docs/ojs/test-no-ojs.qmd", "html", false, [
  {
    name: "OJS runtime is absent",
    verify: async (_output: ExecuteOutput[]) => {
      const url = localFileURL("docs/ojs/test-no-ojs.qmd");
      const result = await inPuppeteer(url, () => {
        return (window._ojs === undefined);
      })();
      assert(result === true, `Expected true, got false instead`);
    },
  },
]);

/*
testRender("docs/ojs/test-ojs-es-modules.qmd", "html", false, [
  {
    name: "OJS runtime is absent",
    verify: async (_output: ExecuteOutput[]) => {
      const url = localFileURL("docs/ojs/test-ojs-es-modules.qmd");
      const result = await inPuppeteer(url, () => {
        return (window._ojs !== undefined);
      })();
      assert(result === true, `Expected true, got false instead`);
    },
  },
]);
*/
