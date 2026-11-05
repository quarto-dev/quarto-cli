/*
* render-scholar.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Element } from "../../../src/core/deno-dom.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
  ensureHtmlElements,
  ensureHtmlSelectorSatisfies,
} from "../../verify.ts";
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

// --id-prefix is passed straight to Pandoc, so it never appears in the
// format's pandoc options.
const inputPrefix = docs("scholar/id-prefix-nocite.qmd");
const outputPrefix = outputForInput(inputPrefix, "html");
testRender(
  inputPrefix,
  "html",
  false,
  [
    ensureHtmlElements(outputPrefix.outputPath, ["#page-ref-adami2020"]),
    ensureHtmlSelectorSatisfies(
      outputPrefix.outputPath,
      "meta[name=citation_reference]",
      (nodes) => nodes.length === 1 &&
        (nodes[0] as Element).getAttribute("content")!.includes(
          "citation_title=Risk of fragility fractures",
        ),
    ),
  ],
  {},
  ["--id-prefix", "page-"],
);
