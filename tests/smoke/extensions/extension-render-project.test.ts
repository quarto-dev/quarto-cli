/*
 * extension-render-project.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { docs } from "../../utils.ts";

import { basename, dirname, extname, join, relative } from "path/mod.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testQuartoCmd } from "../../test.ts";
import { noErrors } from "../../verify.ts";
import { existsSync } from "fs/mod.ts";

const siteOutputForInput = (rootDir: string, input: string) => {
  const dir = join(rootDir, "_site");
  const stem = basename(input, extname(input));

  const outputPath = join(
    dir,
    dirname(relative(rootDir, input)),
    `${stem}.html`,
  );
  const supportPath = join(dir, `site_libs`);

  return {
    outputPath,
    supportPath,
  };
};

const testRender = (
  rootDir: string,
  input: string,
  includeSelectors: string[],
  excludeSelectors: string[],
) => {
  const output = siteOutputForInput(rootDir, input);
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
const rootInput = join(rootDir, "posts/welcome/index.qmd");
testRender(rootDir, rootInput, [
  "a.lightbox",
  "i.fa-solid.fa-anchor",
  "i.fa-solid.fa-bacteria",
  "i.fa-solid.fa-jet-fighter",
], []);

// Render the welcome page (subdirectory) and verify the output
// contains the extension shortcodes and filter elements
const subdirInput = join(rootDir, "posts/welcome/index.qmd");
testRender(rootDir, subdirInput, [
  "a.lightbox",
  "i.fa-solid.fa-anchor",
  "i.fa-solid.fa-bacteria",
  "i.fa-solid.fa-jet-fighter",
], []);
