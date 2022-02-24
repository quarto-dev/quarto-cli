/*
 * yaml-intelligence.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { assert } from "testing/asserts.ts";

import { initTreeSitter } from "../../../src/core/lib/yaml-validation/deno-init-tree-sitter.ts";
import { initPrecompiledModules } from "../../../src/core/lib/yaml-validation/deno-init-precompiled-modules.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  getSchemas,
  resolveSchema,
  schemaCompletions,
} from "../../../src/core/lib/yaml-validation/schema-utils.ts";
import { Completion } from "../../../src/core/lib/yaml-validation/types.ts";

async function fullInit() {
  await initPrecompiledModules();
  await initTreeSitter();
}

unitTest("schema-completions", async () => {
  setInitializer(fullInit);
  await initState();

  const schema = resolveSchema(getSchemas().schemas.engines["knitr"]);
  const completion = schemaCompletions(schema).filter(
    (c: Completion) => c.value === "tbl-column: ",
  )[0].description;

  assert(typeof completion === "string");
  assert(completion.length > 0);
});
