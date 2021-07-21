/*
* ojs-echo-false-codetools.ts
*
* tests that `echo: false` in an ojs cell doesn't break the codetools dropdown
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { testRender } from "../../../smoke/render/render.ts";
import { verifyOjsValue, verifyClickingDoesNotThrow } from "./ojs-utils.ts";
import { localFileURL } from "../../../puppeteer.ts";

const qmd1 = "docs/ojs/test-ojs-echo-false-codetools-dropdown.qmd";
testRender(qmd1, "html", false, [
  verifyClickingDoesNotThrow(localFileURL(qmd1), "#quarto-code-tools-source, #quarto-code-tools-menu"),
]);

const qmd2 = "docs/ojs/test-ojs-echo-false-codetools-dropdown-2.qmd";
testRender(qmd2, "html", false, [
  verifyClickingDoesNotThrow(localFileURL(qmd2), "#quarto-code-tools-source, #quarto-code-tools-menu"),
]);
