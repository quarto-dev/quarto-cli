/*
* deno-init-precompiled-modules.ts
*
* code to initialize yaml intelligence on deno, without loading
* the 600kb of javascript that tree-sitter brings which we don't
* need in the CLI.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../../resources.ts";
import { relative } from "path/mod.ts";
import { setSchemaDefinition } from "./schema.ts";
import { QuartoJsonSchemas, setSchemas, getSchemas } from "./schema-utils.ts";
import { withValidator, loadValidatorModule } from "./validator-queue.ts";

export async function initPrecompiledModules() {

  let before = performance.now();
  setSchemas(JSON.parse(
    Deno.readTextFileSync(
      resourcePath("editor/tools/yaml/quarto-json-schemas.json"),
    ),
  ) as QuartoJsonSchemas);

  const validatorModulePath = resourcePath(
    "editor/tools/yaml/standalone-schema-validators.js",
  );

  before = performance.now();
  await loadValidatorModule(new URL(validatorModulePath, import.meta.url).href);

  before = performance.now();
  const schemaDefs = (await getSchemas()).definitions;
  for (const [_key, value] of Object.entries(schemaDefs)) {
    setSchemaDefinition(value);
    await withValidator(value, async (_validator) => {
    });
  }
}
