/*
* ojs-runs.ts
*
* test that ojs initializes and produces output
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { testRender } from "../../../smoke/render/render.ts";
import { verifyDomTextValue, verifyOjsValue } from "./ojs-utils.ts";
import { localFileURL } from "../../../puppeteer.ts";


const doc = "docs/ojs/test-inline-spans.qmd";
testRender(doc, "html", false, [
  verifyOjsValue(localFileURL(doc), "y", 25),
  verifyDomTextValue(localFileURL(doc), "test-value", "25")
]);

