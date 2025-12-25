import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings, ensureFileRegexMatches } from "../../verify.ts";

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// Test a simple book
const input = docs("books/simple");
const verifySimple = [
  fileExists(join(input, "_book", "Simple.pdf")),
  fileExists(join(input, "_book", "index.html")),
  fileExists(join(input, "_book", "search.json")),
  fileExists(join(input, "_book", "site_libs")),
];
testQuartoCmd(
  "render",
  [input],
  [noErrorsOrWarnings, ...verifySimple],
  {
    teardown: async () => {
      const bookDir = join(input, "_book");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);

// Test a more complex book render
const vizInput = docs("books/visualization-curriculum");
const verifyViz = [
  fileExists(
    join(vizInput, "docs", "Visualization-Curriculum.docx"),
  ),
  fileExists(
    join(vizInput, "docs", "book-asciidoc", "Visualization-Curriculum.adoc"),
  ),
  fileExists(join(vizInput, "docs", "index.html")),
];
testQuartoCmd(
  "render",
  [vizInput],
  [noErrorsOrWarnings, ...verifyViz],
  {
    teardown: async () => {
      const bookDir = join(vizInput, "docs");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);

// Test a Typst book render
const typstInput = docs("books/typst");
const typstPdfPath = join(typstInput, "_book", "Test-Typst-Book.pdf");
// The intermediate .typ file is kept at the project root as index.typ
const typstTypPath = join(typstInput, "index.typ");
const verifyTypst = [
  fileExists(typstPdfPath),
  // Verify content from each chapter is included in the merged output
  ensureFileRegexMatches(typstTypPath, [
    "test book for Typst output format",  // from index.qmd
    "first chapter of the book",           // from chapter1.qmd
    "second chapter of the book",          // from chapter2.qmd
    // Verify unnumbered heading is emitted correctly (not wrapped in #block[])
    // This regex matches Pandoc's native output: #heading(level: 1, numbering: none)[Preface]
    "#heading\\(level: 1, numbering: none\\)\\[Preface\\]",
  ]),
];
testQuartoCmd(
  "render",
  [typstInput],
  [noErrorsOrWarnings, ...verifyTypst],
  {
    teardown: async () => {
      const bookDir = join(typstInput, "_book");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
      // Clean up the kept .typ file
      if (existsSync(typstTypPath)) {
        await Deno.remove(typstTypPath);
      }
    },
  },
);
