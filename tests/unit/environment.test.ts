/*
* environment.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert, assertEquals } from "testing/asserts";
import { getenv } from "../../src/core/env.ts";
import { pandocBinaryPath, resourcePath } from "../../src/core/resources.ts";
import { unitTest } from "../test.ts";

unitTest(
  "environment",
  //deno-lint-ignore require-await
  async () => {
    const d = "B4CE1323-5ED7-43A8-AEF0-4409F42CF3C8";
    const path = getenv("D684CD56-D4DF-476D-ACB7-7E5D404BC743", d);
    assertEquals(
      path,
      d,
      "Incorrect default path returned",
    );
    assert(
      pandocBinaryPath().length > 0,
      "Unable to get path using binaryPath()",
    );

    assert(
      resourcePath("metadata.template").length > 0,
      "Unable to get path using resourcePath('metadata.template')",
    );
  },
);
