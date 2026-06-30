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
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { fileExists, pathDoNotExists } from "../../verify.ts";
import { testRender } from "./render.ts";
import { testSite } from "../site/site.ts";
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

// Test 3: Pre-existing files in the output dir must survive a single-file
// render with --output-dir. A synthetic project (no _quarto.yml) must never
// clean the output dir. Regression test for:
// https://github.com/quarto-dev/quarto-cli/issues/13623
const preExistingFile = join(outputDir, "pre-existing.txt");
testRender(
  "test.qmd",
  "html",
  false,
  [fileExists(preExistingFile)],
  {
    cwd: () => inputDir,
    setup: async () => {
      await cleanupDirs();
      Deno.mkdirSync(outputDir, { recursive: true });
      Deno.writeTextFileSync(preExistingFile, "keep me");
    },
    teardown: cleanupDirs,
  },
  ["--output-dir", outputDir],
  outputDir,
);

// Test 4: A pre-existing nested subdirectory (with content) in the output dir
// must also survive — the synthetic project must not recursively wipe the
// output dir. Same bug as Test 3 (#13623), exercising nested content.
const preExistingNestedDir = join(outputDir, "assets");
const preExistingNestedFile = join(preExistingNestedDir, "logo.txt");
testRender(
  "test.qmd",
  "html",
  false,
  [fileExists(preExistingNestedFile)],
  {
    cwd: () => inputDir,
    setup: async () => {
      await cleanupDirs();
      Deno.mkdirSync(preExistingNestedDir, { recursive: true });
      Deno.writeTextFileSync(preExistingNestedFile, "keep me too");
    },
    teardown: cleanupDirs,
  },
  ["--output-dir", outputDir],
  outputDir,
);

// Test 5: Guard for the narrowness of the #13623 fix. A real project type that
// opts into output-dir cleaning (here `type: website`, which sets
// cleanOutputDir: true) MUST still clean stale files from its output dir on a
// default (clean) render. Removing the forceClean term from the cleaning
// condition must not have disabled the legitimate cleanOutputDir path.
const websiteDir = docs("render-output-dir-website");
const websiteStale = join(websiteDir, "_site", "stale.html");
testSite(
  join(websiteDir, "index.qmd"),
  websiteDir,
  ["body"],
  [],
  {
    setup: async () => {
      Deno.mkdirSync(join(websiteDir, "_site"), { recursive: true });
      Deno.writeTextFileSync(websiteStale, "stale output from a prior render");
    },
  },
  pathDoNotExists(websiteStale), // stale file cleaned by the cleanOutputDir path
);
