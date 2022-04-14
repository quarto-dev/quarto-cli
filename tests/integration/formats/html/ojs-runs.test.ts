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

const computes = "docs/ojs/test-ojs-computes.qmd";
testRender(computes, "html", false, [
  verifyOjsValue(localFileURL(computes), "y", 25),
]);
