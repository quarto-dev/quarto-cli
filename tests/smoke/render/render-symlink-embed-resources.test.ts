/*
 * render-symlink-embed-resources.test.ts
 *
 * Regression test for https://github.com/quarto-dev/quarto-cli/issues/13890
 *
 * When rendering a qmd via a symlinked path with embed-resources: true,
 * the cleanup should not fail due to path mismatch between symlink and real path.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { noErrors, fileExists } from "../../verify.ts";
import { docs } from "../../utils.ts";
import { join, dirname, resolve } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

const testDir = docs("render/symlink-embed-resources");
const testFile = "test.qmd";
const symlinkDir = join(dirname(testDir), "symlink-embed-resources-link");

testQuartoCmd(
  "render",
  [join(symlinkDir, testFile)],
  [
    noErrors,
    fileExists(join(symlinkDir, "test.html")),
  ],
  {
    ignore: isWindows,
    setup: async () => {
      if (existsSync(symlinkDir)) {
        await Deno.remove(symlinkDir);
      }
      // Use absolute paths for symlink to ensure correct resolution
      Deno.symlinkSync(resolve(testDir), resolve(symlinkDir));
    },
    teardown: async () => {
      const htmlViaSymlink = join(symlinkDir, "test.html");
      if (existsSync(htmlViaSymlink)) {
        await Deno.remove(htmlViaSymlink);
      }
      if (existsSync(symlinkDir)) {
        await Deno.remove(symlinkDir);
      }
      const realHtml = join(testDir, "test.html");
      if (existsSync(realHtml)) {
        await Deno.remove(realHtml);
      }
    },
  },
  "Render via symlink with embed-resources (issue #13890)",
);
