import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

import { existsSync } from "fs/mod.ts";
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
