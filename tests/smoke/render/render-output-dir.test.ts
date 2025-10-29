/*
* render-output-dir.test.ts
*
* Test for Windows file locking issue with --output-dir flag
* Regression test for: https://github.com/quarto-dev/quarto-cli/issues/XXXXX
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { docs } from "../../utils.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { pathDoNotExists } from "../../verify.ts";
import { testRender } from "./render.ts";

if (isWindows) {
  const inputDir =  docs("render-output-dir/");
  const quartoDir = ".quarto"
  const outputDir = "output-test-dir"

  testRender(
    "test.qmd",
    "html",
    true,
    [pathDoNotExists(quartoDir)],
    {
      cwd: () => inputDir,
      setup: async () => {
        // Ensure output and quarto dirs are removed before test
        if (existsSync(outputDir)) {
          safeRemoveSync(outputDir, { recursive: true });
        }
        if (existsSync(quartoDir)) {
          safeRemoveSync(quartoDir, { recursive: true });
        }
      },
      teardown: async () => {
        if (existsSync(outputDir)) {
          safeRemoveSync(outputDir, { recursive: true });
        }
        if (existsSync(quartoDir)) {
              safeRemoveSync(quartoDir, { recursive: true });
        }
      },
    },  
    ["--output-dir", outputDir],
    outputDir,
  );
}
