/*
 * book-part-crossref.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// https://github.com/quarto-dev/quarto-cli/issues/2571
const input = docs("books/part-crossref");
const bookDir = join(input, "_book");
const texFile = join(input, "Part-Crossref.tex");

testQuartoCmd(
  "render",
  [input],
  [
    noErrorsOrWarnings,
    ensureFileRegexMatches(join(bookDir, "chapter.html"), [
      /<a href="part\.html" class="quarto-xref"><span>Part One<\/span><\/a>/,
      /<a href="part\.html#sec-part-section" class="quarto-xref">/,
    ]),
    ensureFileRegexMatches(texFile, [
      /\\part\{Part One\}\\label\{sec-part-one\}/,
      /\\hyperref\[sec-part-one\]\{Part One\}/,
      /\\hyperref\[sec-part-section\]\{Part\s+Section\}/,
      // links to files later in the book
      /\\hyperref\[sec-part-two\]\{the\s+second\s+part\}/,
      /\\hyperref\[chapter-two\]\{chapter\s+two\}/,
    ], [
      /\\href\{[^}]*\.qmd\}/,
      /\?@sec-part/,
    ]),
  ],
  {
    // deno-lint-ignore require-await
    teardown: async () => {
      for (const path of [bookDir, texFile, join(input, "site_libs")]) {
        safeRemoveSync(path, { recursive: true });
      }
    },
  },
);
