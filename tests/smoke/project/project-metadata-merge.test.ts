/*
 * project-metadata-merge.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";

import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

const projectDir = docs("project/metadata-merge");
const output = join(projectDir, "doc.html");

testQuartoCmd(
  "render",
  [projectDir, "--to", "html"],
  [
    noErrorsOrWarnings,
    ensureFileRegexMatches(
      output,
      [
        /KEYWORDS: \[project-keyword, shared-keyword, evaluated-keyword\]/,
        /CUSTOM-LIST: \[project-item, evaluated-item\]/,
        /FROM-PROJECT: \[project-value\]/,
        /SHARED: \[document-value\]/,
        /FROM-DOCUMENT: \[document-value\]/,
        /EVALUATED: \[evaluated-scalar\]/,
        /COLLIDING: \[alice\]/,
      ],
      [/<code>[^<]*paste0/],
    ),
  ],
  {
    teardown: () => {
      for (const file of ["doc.html", "doc_files"]) {
        const path = join(projectDir, file);
        if (existsSync(path)) {
          Deno.removeSync(path, { recursive: true });
        }
      }
      return Promise.resolve();
    },
  },
);
