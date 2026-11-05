/*
 * render-embed-website-rerender.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join, resolve } from "../../../src/deno_ral/path.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { Element } from "../../../src/core/deno-dom.ts";
import { docs } from "../../utils.ts";
import {
  ensureHtmlSelectorSatisfies,
  fileExists,
  noErrors,
  pathDoNotExists,
} from "../../verify.ts";
import { test } from "../../test.ts";
import { runQuarto } from "../../quarto-cmd.ts";

// A re-render of a website must keep the notebook preview of an embedded
// qmd, even though the embed notebook is now served from the project
// scratch cache (#10756)
const projectDir = resolve(docs("embed/website-rerender"));
const siteDir = join(projectDir, "_site");

const removeGenerated = () => {
  for (
    const name of [
      "_site",
      ".quarto",
      "index_files",
      "source.embed_files",
      "source_files",
      "source.embed.ipynb",
      "source.embed-preview.html",
    ]
  ) {
    safeRemoveSync(join(projectDir, name), { recursive: true });
  }
};

test({
  name: "embed qmd preview survives a second website render (#10756)",
  context: {
    // Rendering from outside the project loses the preview regardless of
    // this fix (#15004), so run from the project directory
    cwd: () => projectDir,
    setup: () => {
      removeGenerated();
      return Promise.resolve();
    },
    teardown: () => {
      removeGenerated();
      return Promise.resolve();
    },
  },
  execute: async (logFile?: string) => {
    await runQuarto(["render", projectDir], { logFile, throwOnFailure: false });
    await runQuarto(["render", projectDir], { logFile, throwOnFailure: false });
  },
  verify: [
    noErrors,
    fileExists(join(siteDir, "source.embed-preview.html")),
    // download target of the "Source" link
    fileExists(join(siteDir, "source.qmd")),
    // every figure in the preview resolves to a non-empty file in _site
    ensureHtmlSelectorSatisfies(
      join(siteDir, "source.embed-preview.html"),
      "img.figure-img",
      (nodeList) => {
        const srcs = Array.from(nodeList).map((n) =>
          (n as Element).getAttribute("src")
        );
        return srcs.length > 0 && srcs.every((src) =>
          src !== null && existsSync(join(siteDir, src)) &&
          Deno.statSync(join(siteDir, src)).size > 0
        );
      },
    ),
    // figure files were never relocated under the scratch dir
    pathDoNotExists(join(siteDir, ".quarto")),
    // revived notebook isn't re-cached into a nested scratch dir
    pathDoNotExists(join(projectDir, ".quarto", "embed", ".quarto")),
    // staged notebook is removed after rendering the preview
    pathDoNotExists(join(projectDir, "source.embed.ipynb")),
  ],
  type: "smoke",
});
