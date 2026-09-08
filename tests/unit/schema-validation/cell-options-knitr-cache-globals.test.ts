/*
 * cell-options-knitr-cache-globals.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 */

import { assertEquals } from "testing/asserts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { parseAndValidateCellOptions } from "../../../src/core/lib/partition-cell-options.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import { unitTest } from "../../test.ts";

// Deliberately not using `fullInit()` from ./utils.ts here: that also runs
// `ensureSchemaResources()`, which overlays the source `src/resources/schema/`
// yml on top of the generated artifact. Rendering only loads the generated
// artifact, so initializing the same way keeps this test honest about what
// ships -- it fails if `dev-call build-artifacts` was not re-run.
const validateKnitrCell = async (yaml: string) => {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
  return await parseAndValidateCellOptions(
    asMappedString(yaml),
    "r",
    true,
    "knitr",
  );
};

// https://github.com/quarto-dev/quarto-cli/issues/14735
// `cache-globals` was declared as a bare string, so an array (the form
// `cache-vars` accepts) and the documented `false` both failed validation.
unitTest("cache-globals - accepts an array of strings", async () => {
  assertEquals(
    await validateKnitrCell(`cache-globals:\n  - var_1\n  - var_2\n`),
    { "cache-globals": ["var_1", "var_2"] },
  );
});

unitTest("cache-globals - accepts a boolean", async () => {
  assertEquals(
    await validateKnitrCell(`cache-globals: false\n`),
    { "cache-globals": false },
  );
});

unitTest("cache-globals - still accepts a single string", async () => {
  assertEquals(
    await validateKnitrCell(`cache-globals: var_1\n`),
    { "cache-globals": "var_1" },
  );
});
