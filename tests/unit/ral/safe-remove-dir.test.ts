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
