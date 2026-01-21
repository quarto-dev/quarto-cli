/*
* safe-remove-dir.test.ts
*
* Copyright (C) 2025 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";
import { assert, assertThrows } from "testing/asserts";

import { createTempContext } from "../../../src/core/temp.ts";
import { ensureDirSync, safeRemoveDirSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

unitTest("safeRemoveDirSync", async () => {

  const temp = createTempContext();

  const d1 = temp.createDir();
  const path = join(d1, "do-not-touch");
  const boundary = join(d1, "project-root");
  ensureDirSync(path);
  ensureDirSync(boundary);

  assertThrows(() => {
    safeRemoveDirSync(path, boundary);
  });

  assert(Deno.statSync(path).isDirectory);

  temp.cleanup();
});

unitTest("safeRemoveDirSync with symlinks", async () => {
  const temp = createTempContext();

  const realDir = temp.createDir();
  const projectRoot = join(realDir, "project-root");
  const subDir = join(projectRoot, "test_files");
  ensureDirSync(projectRoot);
  ensureDirSync(subDir);

  const symlinkPath = join(realDir, "project-symlink");
  Deno.symlinkSync(projectRoot, symlinkPath);

  // Test: path via symlink, boundary via real path - should succeed
  const pathViaSymlink = join(symlinkPath, "test_files");
  safeRemoveDirSync(pathViaSymlink, projectRoot);

  // Recreate for next test
  ensureDirSync(subDir);

  // Test: path via real path, boundary via symlink - should succeed
  safeRemoveDirSync(subDir, symlinkPath);

  // Cleanup symlink
  Deno.removeSync(symlinkPath);

  temp.cleanup();
}, { ignore: isWindows });
