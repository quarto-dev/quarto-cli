/*
 * project-output-dir-safety.test.ts
 *
 * Test for issue #13892: output-dir configurations should not delete project files
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */
import { docs } from "../../utils.ts";

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrors } from "../../verify.ts";

// Helper to clean up website output files from a directory
// Used when output-dir points to the project directory itself
async function cleanWebsiteOutput(dir: string) {
  const filesToRemove = ["index.html", "test.html", "search.json"];
  const dirsToRemove = ["site_libs", ".quarto"];

  for (const file of filesToRemove) {
    const path = join(dir, file);
    if (existsSync(path)) {
      await Deno.remove(path);
    }
  }
  for (const subdir of dirsToRemove) {
    const path = join(dir, subdir);
    if (existsSync(path)) {
      await Deno.remove(path, { recursive: true });
    }
  }
}

// Helper to create output-dir safety tests
function testOutputDirSafety(
  name: string,
  outputDir: string | null, // null means output is in project dir (website type)
) {
  const testDir = docs(`project/output-dir-${name}`);
  const dir = join(Deno.cwd(), testDir);
  const outputPath = outputDir ? join(dir, outputDir) : dir;

  testQuartoCmd(
    "render",
    [testDir],
    [
      noErrors,
      fileExists(join(dir, "marker.txt")),       // Project file must survive
      fileExists(join(outputPath, "test.html")), // Output created correctly
    ],
    {
      teardown: async () => {
        // Clean up rendered output
        if (outputDir) {
          // Subdirectory case - remove the whole output dir
          if (existsSync(outputPath)) {
            await Deno.remove(outputPath, { recursive: true });
          }
          // Clean up .quarto directory
          const quartoDir = join(dir, ".quarto");
          if (existsSync(quartoDir)) {
            await Deno.remove(quartoDir, { recursive: true });
          }
        } else {
          // In-place website case - clean up website output files only
          await cleanWebsiteOutput(dir);
        }
      },
    },
  );
}

// Test 1: output-dir: ./ (the bug case from #13892)
testOutputDirSafety("safety", null);

// Test 2: output-dir: . (without trailing slash)
testOutputDirSafety("dot", null);

// Test 3: output-dir: _output (normal subdirectory case)
testOutputDirSafety("subdir", "_output");

// Test 4: output-dir: ../dirname (parent traversal back to project dir)
// This tests the case where output-dir references the project directory
// via parent traversal (e.g., project in "quarto-proj", output-dir: "../quarto-proj")
testOutputDirSafety("parent-ref", null);
