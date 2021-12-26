/*
* ojs-runs.ts
*
* test that ojs initializes and produces output
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { testRender } from "../../../smoke/render/render.ts";
import { verifyOjsValue } from "./ojs-utils.ts";
import { localFileURL } from "../../../puppeteer.ts";

/*
const computes = "docs/ojs/test-ojs-es-modules.qmd";
testRender(computes, "html", false, [
  verifyOjsValue(localFileURL(computes), "x", 35),
]);
*/
