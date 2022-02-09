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
import { ensureAjv } from "../../../src/core/schema/yaml-schema.ts";

export const schemaTestFile = fileLoader("schema-validation");

export async function fullInit() {
  await initPrecompiledModules();
  await initTreeSitter();
  await ensureAjv();
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
