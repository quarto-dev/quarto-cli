/*
* extension-dirs.test.ts
*
* Copyright (C) 2020-2026 Posit Software, PBC
*
*/

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { inputExtensionDirs } from "../../src/extension/extension.ts";

// Test for issue #14254: inputExtensionDirs should not hang when
// projectDir is the filesystem root.
// deno-lint-ignore require-await
unitTest("extension-dirs - no infinite loop at filesystem root", async () => {
  const tempDir = Deno.makeTempDirSync({ prefix: "quarto-test-ext" });
  const tempFile = `${tempDir}/test.qmd`;
  Deno.writeTextFileSync(tempFile, "---\ntitle: test\n---\n");

  // With projectDir = "/", the dirname loop must terminate at root.
  // If the root guard is missing, this call hangs forever.
  const dirs = inputExtensionDirs(tempFile, "/");
  assert(Array.isArray(dirs), "inputExtensionDirs should return an array");

  Deno.removeSync(tempDir, { recursive: true });
});
