/*
 * yaml-intelligence.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { assert } from "testing/asserts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  schemaCompletions,
} from "../../../src/core/lib/yaml-validation/schema-utils.ts";
import { Completion } from "../../../src/core/lib/yaml-schema/types.ts";
import { getEngineOptionsSchema } from "../../../src/core/lib/yaml-schema/chunk-metadata.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

unitTest("schema-completions", async () => {
  setInitializer(fullInit);
  await initState();

  const schema = (await getEngineOptionsSchema())["knitr"];
  const completion = schemaCompletions(schema).filter(
    (c: Completion) => c.value === "tbl-column: ",
  )[0].description;

  assert(typeof completion === "string");
  assert(completion.length > 0);
});
