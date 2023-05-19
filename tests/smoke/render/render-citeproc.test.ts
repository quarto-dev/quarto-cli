/*
* render-reveal.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import {
  ensureHtmlSelectorSatisfies,
} from "../../verify.ts";
import { testRender } from "./render.ts";

// No duplicated reference when citeproc: true
let input = docs("test-citeproc.qmd");
let output = outputForInput(input, "html");
testRender(input, "html", false, [ 
  ensureHtmlSelectorSatisfies(
    output.outputPath,
    "div[id='ref-guo2020']",
    (nodeList) => {
      return nodeList.length === 1;
    },
  ),
]);
