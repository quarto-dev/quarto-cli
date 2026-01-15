/*
 * website-sidebar-auto.test.ts
 *
 * Verifies that sidebar auto-generation properly detects index files with
 * non-qmd extensions (like .ipynb) in subdirectories. This tests the
 * engineValidExtensions() call in indexFileHrefForDir() which must work
 * before resolveEngines() has been called.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

const renderDir = docs("websites/website-sidebar-auto");
const outDir = join(Deno.cwd(), renderDir, "_site");

// Test that sidebar auto-generation detects index.ipynb in subdirectory
testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrorsOrWarnings,
    fileExists(join(outDir, "index.html")),              // Main index page
    fileExists(join(outDir, "subdir", "index.html")),    // Subdir index from .ipynb should be rendered
  ],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);
