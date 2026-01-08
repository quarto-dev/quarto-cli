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
import type { Verify } from "../../test.ts";


const inputDir = docs("render-output-dir/");
const quartoDir = ".quarto";
const outputDir = "output-test-dir";

const cleanupDirs = async () => {
  if (existsSync(outputDir)) {
    safeRemoveSync(outputDir, { recursive: true });
  }
  if (existsSync(quartoDir)) {
    safeRemoveSync(quartoDir, { recursive: true });
  }
};

const testOutputDirRender = (
  quartoVerify: Verify,
  extraArgs: string[] = [],
) => {
  testRender(
    "test.qmd",
    "html",
    false,
    [quartoVerify],
    {
      cwd: () => inputDir,
      setup: cleanupDirs,
      teardown: cleanupDirs,
    },
    ["--output-dir", outputDir, ...extraArgs],
    outputDir,
  );
};

// Test 1: Default behavior (clean=true) - .quarto should be removed
testOutputDirRender(pathDoNotExists(quartoDir));

// Test 2: With --no-clean flag - .quarto should be preserved
testOutputDirRender(fileExists(quartoDir), ["--no-clean"]);
