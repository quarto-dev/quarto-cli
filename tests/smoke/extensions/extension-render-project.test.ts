/*
 * extension-render-project.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { docs, projectOutputForInput } from "../../utils.ts";

import { basename, dirname, extname, join, relative } from "../../../src/deno_ral/path.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testQuartoCmd } from "../../test.ts";
import { noErrors } from "../../verify.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";

const testRender = (
  input: string,
  includeSelectors: string[],
  excludeSelectors: string[],
) => {
  const output = projectOutputForInput(input);
  const verifySel = ensureHtmlElements(
    output.outputPath,
    includeSelectors,
    excludeSelectors,
  );

  // Run the command
  testQuartoCmd(
    "render",
    [input],
    [noErrors, verifySel],
    {
      teardown: async () => {
        const siteDir = dirname(output.supportPath);
        if (existsSync(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};

// The site root dir
const rootDir = docs("extensions/project/");

// Render the home page and verify the output
// contains the extension shortcodes and filter elements
testRender(join(rootDir, "posts/welcome/index.qmd"), [
  "a.lightbox",
  "i.fa-solid.fa-anchor",
  "i.fa-solid.fa-bacteria",
  "i.fa-solid.fa-jet-fighter",
], []);

// Render the welcome page (subdirectory) and verify the output
// contains the extension shortcodes and filter elements
const subdirInput = join(rootDir, "posts/welcome/index.qmd");
testRender(join(rootDir, "posts/welcome/index.qmd"), [
  "a.lightbox",
  "i.fa-solid.fa-anchor",
  "i.fa-solid.fa-bacteria",
  "i.fa-solid.fa-jet-fighter",
], []);
