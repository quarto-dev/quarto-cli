/*
* render-output-dir.test.ts
*
* Test for Windows file locking issue with --output-dir flag
* Regression test for: https://github.com/quarto-dev/quarto-cli/issues/13625
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { docs } from "../../utils.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { fileExists, pathDoNotExists } from "../../verify.ts";
import { testRender } from "./render.ts";

if (isWindows) {
  const inputDir = docs("render-output-dir/");
  const quartoDir = ".quarto";
  const outputDir = "output-test-dir";

  // Test 1: Default behavior (clean=true) - .quarto should be removed
  testRender(
    "test.qmd",
    "html",
    false,
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

  // Test 2: With --no-clean flag - .quarto should be preserved
  testRender(
    "test.qmd",
    "html",
    false,
    [fileExists(quartoDir)],
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
    ["--output-dir", outputDir, "--no-clean"],
    outputDir,
  );
}
