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
import { setSchemaDefinition } from "./schema.ts";
import { getSchemas, QuartoJsonSchemas, setSchemas } from "./schema-utils.ts";
import { withValidator } from "./validator-queue.ts";
import { setValidatorModulePath } from "./staged-validator.ts";

export async function initPrecompiledModules() {
  setSchemas(JSON.parse(
    Deno.readTextFileSync(
      resourcePath("editor/tools/yaml/quarto-json-schemas.json"),
    ),
  ) as QuartoJsonSchemas);

  setValidatorModulePath(resourcePath(
    "editor/tools/yaml/standalone-schema-validators.js",
  ));

  const schemaDefs = (await getSchemas()).definitions;
  for (const [_key, value] of Object.entries(schemaDefs)) {
    setSchemaDefinition(value);
    // FIXME pretty sure this isn't doing anything now that we have two-stage validators.
    // test and remove
    await withValidator(value, async (_validator) => {
    });
  }
}
