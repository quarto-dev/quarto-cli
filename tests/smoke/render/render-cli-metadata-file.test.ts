/*
 * render-cli-metadata-file.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";

import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

const dir = docs("metadata-merge-cli");
const input = join(dir, "cli-metadata-file.qmd");
const output = join(dir, "cli-metadata-file.html");

// the document's front matter wins over a --metadata-file for a value both
// define, and what only the metadata file defines is kept
testQuartoCmd(
  "render",
  [
    input,
    "--to",
    "html",
    "--metadata-file",
    join(dir, "cli-metadata-file.yml"),
  ],
  [
    noErrorsOrWarnings,
    ensureFileRegexMatches(output, [
      /<meta name="keywords" content="metadata-file-keyword, document-keyword">/,
      /<div id="shared">\s*<p>document-value<\/p>/,
      /<div id="custom-shared">\s*<p>document-value<\/p>/,
      /<div id="custom-from-document">\s*<p>document-value<\/p>/,
      /<div id="custom-from-metadata-file">\s*<p>metadata-file-value<\/p>/,
    ]),
  ],
  {
    teardown: () => {
      for (const file of ["cli-metadata-file.html", "cli-metadata-file_files"]) {
        const path = join(dir, file);
        if (existsSync(path)) {
          Deno.removeSync(path, { recursive: true });
        }
      }
      return Promise.resolve();
    },
  },
);
