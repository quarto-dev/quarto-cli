/*
* render-callout.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { outputForInput } from "../utils.ts";
import { ensureHtmlElements } from "../verify.ts";
import { testRender } from "./render.ts";

const output = outputForInput("docs/callouts.qmd", "html");
testRender("docs/callouts.qmd", "html", false, [
  ensureHtmlElements(output.outputPath, [
    "div.callout-warning",
    "div.callout-important",
    "div.callout-note",
    "div.callout-tip",
    "div.callout-caution",
    "div.callout.no-icon",
  ]),
]);
