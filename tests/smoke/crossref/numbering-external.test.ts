/*
* numbering-external.test.ts
*
* T8.2: full TS -> QUARTO_FILTER_PARAMS blob -> Lua param() traverse for
* crossref.numbering: external. Asserts the caption text is present but
* carries no Quarto-assigned "Figure N" prefix, and that Lua's numbering
* pass reports the resulting missing 'order' field -- together these say
* "the external path actually ran" rather than merely "the render
* produced no output" (prefix-absence alone) or "an unrelated warning
* fired" (stderr alone).
*
* Copyright (C) 2026 Posit Software, PBC
*
*/

import { assert } from "testing/asserts";
import {
  ensureDocxRegexMatches,
  printsMessage,
  verifyDocXDocument,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const numberingExternal = crossref("numbering-external.qmd", "docx");

function text(text: string) {
  return RegExp(`>${text}<`);
}

const noFigurePrefix = verifyDocXDocument(async (xml) => {
  assert(
    !/>Figure ?\d+[:.]?/.test(xml),
    "Docx caption unexpectedly carries a Quarto-assigned 'Figure N' prefix.",
  );
  return Promise.resolve();
}, "Docx caption carries no Quarto-assigned Figure prefix");

testRender(numberingExternal.input, "docx", true, [
  ensureDocxRegexMatches(numberingExternal.output.outputPath, [
    // caption body text is present...
    text("Elephant"),
  ]),
  // ...but carries no Quarto-assigned "Figure N" prefix
  noFigurePrefix(numberingExternal.output.outputPath),
  // Lua's numbering pass reports the order it never assigned (warn()
  // surfaces as level INFO on the TS side, see docx.test.ts's T3.6 guard)
  printsMessage({
    level: "INFO",
    regex: "field 'order' is missing from float",
  }),
]);
