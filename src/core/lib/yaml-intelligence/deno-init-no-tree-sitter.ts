/*
* deno-init-no-tree-sitter.ts
*
* code to initialize yaml intelligence on deno, without loading
* the 600kb of javascript that tree-sitter brings which we don't
* need in the CLI.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../../resources.ts";
import { QuartoJsonSchemas, setSchemas, getSchemas } from "./schema-utils.ts";
import { loadValidatorModule, withValidator } from "./validator-queue.ts";

export function init(skipCompiledModules = false) {
  return async () => {
    if (!skipCompiledModules) {
      setSchemas(JSON.parse(
        Deno.readTextFileSync(
          resourcePath("editor/tools/yaml/quarto-json-schemas.json"),
        ),
      ) as QuartoJsonSchemas);
      
      const validatorModulePath = resourcePath(
        "editor/tools/yaml/standalone-schema-validators.js",
      );
      await loadValidatorModule(validatorModulePath);
      
      const schemaDefs = (await getSchemas()).definitions;
      for (const [_key, value] of Object.entries(schemaDefs)) {
        await withValidator(value, async (_validator) => {
        });
      }
    }
  };
}
