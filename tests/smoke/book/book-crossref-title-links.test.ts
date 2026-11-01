/*
 * book-crossref-title-links.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// https://github.com/quarto-dev/quarto-cli/issues/1196
const input = docs("books/crossref-title-links");
const bookDir = join(input, "_book");

testQuartoCmd(
  "render",
  [input],
  [
    noErrorsOrWarnings,
    ensureFileRegexMatches(join(bookDir, "chapter.html"), [
      /<a href="index\.html" class="quarto-xref"><span>Introduction<\/span><\/a>/,
      /<a href="index\.html#sec-details" class="quarto-xref"><span>Some details<\/span><\/a>/,
      /<a href="index\.html#eq-named" class="quarto-xref"><span>the identity<\/span><\/a>/,
      // equation without a name falls back to a numbered reference
      /<a href="index\.html#eq-plain" class="quarto-xref"><span>Equation&nbsp;1\.2<\/span><\/a>/,
    ]),
  ],
  {
    // deno-lint-ignore require-await
    teardown: async () => {
      safeRemoveSync(bookDir, { recursive: true });
    },
  },
);
