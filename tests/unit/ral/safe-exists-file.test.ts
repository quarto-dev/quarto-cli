/*
 * safe-exists-file.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";

import { createTempContext } from "../../../src/core/temp.ts";
import { safeExistsFileSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

// deno-lint-ignore require-await
unitTest("safeExistsFileSync", async () => {
  const temp = createTempContext();
  const dir = temp.createDir();
  const file = join(dir, "a.txt");
  Deno.writeTextFileSync(file, "x");

  assert(safeExistsFileSync(file), "existing file should be true");
  assert(!safeExistsFileSync(dir), "directory should be false");
  assert(
    !safeExistsFileSync(join(dir, "missing.txt")),
    "missing path should be false",
  );

  temp.cleanup();
});
