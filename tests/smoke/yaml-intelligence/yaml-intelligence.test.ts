/*
 * yaml-intelligence.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { expandGlobSync } from "../../../src/core/deno/expand-glob.ts";
import { unitTest } from "../../test.ts";

import { assert, assertEquals } from "testing/asserts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  CompletionResult,
  getAutomation,
} from "../../../src/core/lib/yaml-intelligence/yaml-intelligence.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

unitTest("yaml-intelligence-smoke-regression", async () => {
  setInitializer(fullInit);
  await initState();

  for (
    const { path: fileName } of expandGlobSync(
      "smoke/yaml-intelligence/crashes/*.json",
    )
  ) {
    const { kind, context } = JSON.parse(Deno.readTextFileSync(fileName));
    try {
      await getAutomation(kind, context);
    } catch (e) {
      console.error("\n\n");
      console.error("Regression failure, case:", fileName);
      console.error(e);
      assert(false, "Smoke assertion failed");
    }
  }
});

unitTest("yaml-intelligence-unit-regression", async () => {
  setInitializer(fullInit);
  await initState();

  for (
    const { path: fileName } of expandGlobSync(
      "smoke/yaml-intelligence/checks/*.json",
    )
  ) {
    const input = JSON.parse(Deno.readTextFileSync(fileName));
    const { kind, context, expected, expectedLength } = input;
    const result = await getAutomation(kind, context);

    assert(result !== null);

    try {
      if (expected !== undefined) {
        assertEquals(result, expected);
      }

      if (kind === "completions") {
        if (expectedLength !== undefined) {
          assertEquals(
            (result as CompletionResult).completions.length,
            expectedLength,
          );
        }
      }
    } catch (e) {
      console.error("\n\nRegression failure, case:", fileName);
      throw e;
    }
  }
});
