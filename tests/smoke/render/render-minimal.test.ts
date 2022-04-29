/*
* render-callout.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("minimal.qmd");
const htmlOutput = outputForInput(input, "html");

testRender(input, "html", false, [
  ensureHtmlElements(htmlOutput.outputPath, [], [
    "script#quarto-html-after-body",
  ]),
]);
