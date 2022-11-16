/*
* ojs-runs.ts
*
* test that ojs initializes and produces output
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { testRender } from "../../../smoke/render/render.ts";
import { verifyDomTextValue, verifyOjsValue } from "./ojs-utils.ts";
import { localFileURL } from "../../../puppeteer.ts";

const doc = "docs/ojs/test-inline-spans.qmd";
testRender(doc, "html", true, [
  verifyOjsValue(localFileURL(doc), "y", 25),
  verifyDomTextValue(localFileURL(doc), "test-value", "25"),
]);
