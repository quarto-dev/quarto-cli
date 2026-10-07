/*
 * project-metadata-merge.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";

import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

const projectDir = docs("project/metadata-merge");

// keys defined in both _quarto.yml and the front matter are merged: the
// document wins shared leaves, the project's other leaves and list entries stay
const mergedKeys = [
  /KEYWORDS: \[project-keyword, shared-keyword, document-keyword\]/,
  /PARAMS: \[project-value\] \[document-value\]/,
  /FROM-PROJECT: \[project-value\]/,
  /SHARED: \[document-value\]/,
  /FROM-DOCUMENT: \[document-value\]/,
  /CUSTOM-LIST: \[project-item, document-item\]/,
  /<div id="lua-params">\s*<p>project-value<\/p>/,
];

testQuartoCmd(
  "render",
  [projectDir, "--to", "html"],
  [
    noErrorsOrWarnings,
    ensureFileRegexMatches(join(projectDir, "markdown.html"), mergedKeys),
    ensureFileRegexMatches(
      join(projectDir, "knitr.html"),
      [
        ...mergedKeys,
        // a key holding an inline expression takes the executed value as a
        // whole, without repeating a value the project also lists
        /TAGS: \[project-tag, document-tag\]/,
        /EVALUATED: \[evaluated-value\]/,
      ],
      [/`\{r\}/],
    ),
  ],
  {
    teardown: () => {
      for (
        const file of [
          "markdown.html",
          "markdown_files",
          "knitr.html",
          "knitr_files",
        ]
      ) {
        const path = join(projectDir, file);
        if (existsSync(path)) {
          Deno.removeSync(path, { recursive: true });
        }
      }
      return Promise.resolve();
    },
  },
);
