/*
* render-scholar.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs, outputForInput } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const input = docs("scholar/test.qmd");
const output = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureHtmlElements(output.outputPath, [
    "meta[name=citation_keywords]",
    "meta[name=citation_publication_date]",
  ]),
]);

const inputGen = docs("scholar/generated-bib.qmd");
const outputGen = outputForInput(inputGen, "html");
testRender(inputGen, "html", false, [
  ensureHtmlElements(outputGen.outputPath, [
    "meta[name=citation_keywords]",
    "meta[name=citation_publication_date]",
  ]),
]);
