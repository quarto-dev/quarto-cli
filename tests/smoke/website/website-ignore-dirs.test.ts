/*
 * website-ignore-dirs.test.ts
 *
 * Verifies that engine-specific ignore directories (venv, renv, env, packrat, etc.)
 * are properly excluded from website file discovery and rendering.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrors, pathDoNotExists } from "../../verify.ts";

const renderDir = docs("websites/website-ignore-dirs");
const outDir = join(Deno.cwd(), renderDir, "_site");

// Test that engine ignore directories are properly excluded
testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrors,
    fileExists(join(outDir, "index.html")),              // Control: regular file should be rendered
    pathDoNotExists(join(outDir, "venv", "test.html")),  // venv (Jupyter) should be ignored
    pathDoNotExists(join(outDir, "renv", "test.html")),  // renv (Knitr) should be ignored
    pathDoNotExists(join(outDir, "env", "test.html")),   // env (Jupyter) should be ignored
  ],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);
