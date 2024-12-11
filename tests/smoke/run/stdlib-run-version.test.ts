/*
 * stdlib-run-version.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { execProcess } from "../../../src/core/process.ts";
import { assert } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

unitTest("stdlib-run-version", async () => {
  const result = await execProcess({
    cmd: [
      "quarto",
      "run",
      "docs/run/test-stdlib.ts",
    ],
  });
  console.log({result})
  assert(result.success);
}, {
  ignore: isWindows,
});
