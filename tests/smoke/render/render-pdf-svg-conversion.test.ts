/*
* render-pdf-svg-conversion.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { which } from "../../../src/core/path.ts";
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches, ensureLatexFileRegexMatches, printsMessage } from "../../verify.ts";

import { testRender } from "./render.ts";

// Check for rsvg-convert availability (static for this test run)
const hasRsvgConvert = await which("rsvg-convert") !== undefined;

// Test 1: SVG to PDF with rsvg-convert available
// Only runs if rsvg-convert is on PATH
// Verifies that SVG is converted to PDF (not kept as SVG)Skipping SVG conversion for " .. path .. " because output file already exists:
const test1Input = docs("svg-conversion/with-rsvg/index.qmd");
const test1Output = outputForInput(test1Input, "pdf");
testRender(test1Input, "pdf", false, [
  ensureLatexFileRegexMatches(
    test1Output.outputPath,
    [
      /\\includegraphics(\[.*?\])?\{[^}]*simple-svg\.pdf[^}]*\}/,  // Converted PDF included
    ],
    [
      /\\includesvg/,  // Should NOT use includesvg (SVG was converted)
    ],
  ),
], {
  ignore: !hasRsvgConvert,
});

// Test 2: SVG to PDF without rsvg-convert, with pre-converted PDF
// Should use existing PDF without warnings
const test2Input = docs("svg-conversion/with-rsvg-with-pdf/index.qmd");
const test2Output = outputForInput(test2Input, "pdf");
testRender(test2Input, "pdf", false, [
  ensureLatexFileRegexMatches(
    test2Output.outputPath,
    [
      /\\includegraphics(\[.*?\])?\{[^}]*simple-svg\.pdf[^}]*\}/,  // Existing PDF included
    ],
    [
      /\\includesvg/,  // Should NOT use includesvg (PDF was provided)
    ],
  ),
  printsMessage({
    level: "INFO",
    regex: "Skipping SVG conversion .* because output file already exists"
  }),
]);

// Test 3: SVG without rsvg-convert and no pre-converted PDF
// Uses format: latex (not pdf) to generate .tex without compiling
// Avoids LaTeX/Inkscape dependencies that would cause test to fail
const test3Input = docs("svg-conversion/without-rsvg-no-pdf.qmd");
const test3Output = outputForInput(test3Input, "latex");
testRender(test3Input, "latex", true, [
  printsMessage({
    level: "INFO",
    regex: "Skipping SVG conversion.*required PDF file does not exist"
  }),
  ensureFileRegexMatches(
    test3Output.outputPath,
    [
      /\\usepackage(\[.*?\])?\{svg\}/,  // SVG package loaded
      /\\includesvg(\[.*?\])?\{[^}]*test-no-pdf[^}]*\}/,  // includesvg command for our SVG
    ],
  ),
]);
