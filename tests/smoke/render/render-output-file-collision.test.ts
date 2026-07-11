/*
 * render-output-file-collision.test.ts
 *
 * Regression tests for https://github.com/quarto-dev/quarto-cli/issues/14669:
 * pairing an html format with a markdown format while output-file has an
 * .html extension (e.g. output-file: index.html, as nbdev sets for llms.txt
 * workflows) names the markdown output index.html.md — the same path as the
 * keep-md intermediate convention for the html format. Render cleanup was
 * deleting the markdown output, failing website renders at the output-move
 * step and silently losing the file in default-type projects.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 *
 */
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";
import { testQuartoCmd } from "../../test.ts";
import {
  ensureFileRegexMatches,
  fileExists,
  pathDoNotExists,
  printsMessage,
} from "../../verify.ts";

const cleanup = (dir: string, paths: string[]) => {
  return () => {
    for (const path of paths) {
      const target = join(dir, path);
      if (existsSync(target)) {
        safeRemoveSync(target, { recursive: true });
      }
    }
    return Promise.resolve();
  };
};

// paths a failed (pre-fix) render strands in the project root; clean them
// too so a regression doesn't leave debris behind
const websiteOutputs = [
  "_site",
  ".quarto",
  "index.html",
  "site_libs",
  "index.commonmark.md",
];

// website project: the render errored at the output-move step and left
// index.html + site_libs stranded in the project root
const websiteDir = docs("output-file-collision/website");
testQuartoCmd(
  "render",
  [websiteDir],
  [
    fileExists(join(websiteDir, "_site", "index.html")),
    fileExists(join(websiteDir, "_site", "index.html.md")),
    pathDoNotExists(join(websiteDir, "index.html")),
    pathDoNotExists(join(websiteDir, "site_libs")),
  ],
  {
    setup: cleanup(websiteDir, websiteOutputs),
    teardown: cleanup(websiteDir, websiteOutputs),
  },
  "#14669 website: output-file index.html + commonmark renders both outputs",
);

// default-type project: the render exited 0 but the markdown output was
// silently missing
const defaultDir = docs("output-file-collision/default");
const defaultOutputs = [
  "index.html",
  "index.html.md",
  "index_files",
  "site_libs",
  "index.commonmark.md",
];
testQuartoCmd(
  "render",
  [defaultDir],
  [
    fileExists(join(defaultDir, "index.html")),
    fileExists(join(defaultDir, "index.html.md")),
  ],
  {
    setup: cleanup(defaultDir, [...defaultOutputs, ".quarto"]),
    teardown: cleanup(defaultDir, [...defaultOutputs, ".quarto"]),
  },
  "#14669 default project: markdown output is not silently dropped",
);

// keep-md: true wants to write its intermediate to the same path the
// markdown format owns: the intermediate write is skipped with a warning and
// the markdown output wins
const keepmdDir = docs("output-file-collision/keepmd");
testQuartoCmd(
  "render",
  [keepmdDir],
  [
    printsMessage({ level: "WARN", regex: /not saving the keep-md/ }),
    fileExists(join(keepmdDir, "_site", "index.html.md")),
    // the markdown twin holds the commonmark render of the document, not the
    // executed-markdown intermediate (which carries a yaml header)
    ensureFileRegexMatches(join(keepmdDir, "_site", "index.html.md"), [
      /Keep md content\./,
    ], [
      /^---$/,
    ]),
  ],
  {
    setup: cleanup(keepmdDir, websiteOutputs),
    teardown: cleanup(keepmdDir, websiteOutputs),
  },
  "#14669 keep-md: intermediate write is skipped with a warning on collision",
);
