/*
* render-callout.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("minimal.qmd");
const htmlOutput = outputForInput(input, "html");

testRender(input, "html", true, [
  ensureHtmlElements(htmlOutput.outputPath, [], [
    "script#quarto-html-after-body",
  ]),
]);
