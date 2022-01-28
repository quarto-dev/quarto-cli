/*
* utils.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { fileLoader } from "../../utils.ts";
import { unitTest } from "../../test.ts";
import { initTreeSitter } from "../../../src/core/lib/yaml-validation/deno-init-tree-sitter.ts";
import { initPrecompiledModules } from "../../../src/core/lib/yaml-validation/deno-init-precompiled-modules.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  compileSchema,
  ensureAjv,
} from "../../../src/core/schema/yaml-schema.ts";
import { setObtainFullValidator } from "../../../src/core/lib/yaml-validation/staged-validator.ts";

export const schemaTestFile = fileLoader("schema-validation");

export async function fullInit() {
  await initPrecompiledModules();
  await initTreeSitter();
  await ensureAjv();

  const compiledSchemaCache: Record<string, any> = {};

  setObtainFullValidator((schema) => {
    if (compiledSchemaCache[schema.$id] === undefined) {
      compiledSchemaCache[schema.$id] = compileSchema(schema);
    }
    return compiledSchemaCache[schema.$id];
  });
}

export async function yamlValidationUnitTest(
  name: string,
  fun: () => Promise<unknown>,
) {
  unitTest(name, async () => {
    setInitializer(fullInit);
    await initState();
    await fun();
  });
}
