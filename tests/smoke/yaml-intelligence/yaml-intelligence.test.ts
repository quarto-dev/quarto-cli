/*
* yaml-intelligence.test.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/
import { expandGlobSync } from "fs/mod.ts";
import { unitTest } from "../../test.ts";

import { assert, assertEquals } from "testing/asserts.ts";

import { init } from "../../../src/core/lib/yaml-intelligence/deno-init.ts";
import { getAutomation, CompletionResult } from "../../../src/core/lib/yaml-intelligence/yaml-intelligence.ts";

unitTest("yaml-intelligence-smoke-regression", async () => {
  await init();
  for (const { path: fileName } of expandGlobSync("smoke/yaml-intelligence/crashes/*.json")) {
    const { kind, context } = JSON.parse(Deno.readTextFileSync(fileName));
    await getAutomation(kind, context);
  }
});

unitTest("yaml-intelligence-unit-regression", async () => {
  await init();
  for (const { path: fileName } of expandGlobSync("smoke/yaml-intelligence/checks/*.json")) {
    const { kind, context, expected, expectedLength } = JSON.parse(Deno.readTextFileSync(fileName));
    const result = await getAutomation(kind, context);

    assert(result !== null);
    
    if (expected !== undefined) {
      assertEquals(result, expected);
    }
    
    if (kind === "completions") {
      if (expectedLength !== undefined) {
        assertEquals((result as CompletionResult).completions.length, expectedLength);
      }
    }
  }
});
