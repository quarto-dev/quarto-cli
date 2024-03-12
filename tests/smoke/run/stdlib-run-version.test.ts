/*
 * stdlib-run-version.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { execProcess } from "../../../src/core/process.ts";
import { assert } from "testing/asserts.ts";
import { unitTest } from "../../test.ts";

unitTest("yaml-intelligence-unit-regression", async () => {
  const result = await execProcess("quarto", {
    args: [
      "run",
      "docs/run/test-stdlib.ts",
    ],
  });
  assert(result.success);
}, {
  ignore: Deno.build.os == "windows",
});
