/*
 * render-pdf-standard-env.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 *
 * Tests that QUARTO_PDF_STANDARD environment variable is used as a fallback
 * when no pdf-standard is set in the document YAML.
 */

import { docs, outputForInput } from "../../utils.ts";
import { ensureLatexFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("render/pdf-standard-env.qmd");
const output = outputForInput(input, "pdf");

// Test that QUARTO_PDF_STANDARD env var applies ua-2 even though
// the document has no pdf-standard in its YAML
testRender(input, "pdf", true, [
  ensureLatexFileRegexMatches(
    output.outputPath,
    [/\\DocumentMetadata\{/, /pdfstandard=\{ua-2\}/, /tagging=on/],
    [],
    input,
  ),
], {
  env: {
    QUARTO_PDF_STANDARD: "ua-2",
  },
});
