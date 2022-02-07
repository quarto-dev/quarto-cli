/*
* deno-init-precompiled-modules.ts
*
* initializes yaml intelligence using precompiled schemas.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../../resources.ts";
import { setSchemaDefinition } from "./schema.ts";
import { getSchemas, QuartoJsonSchemas, setSchemas } from "./schema-utils.ts";

export async function initPrecompiledModules() {
  setSchemas(JSON.parse(
    Deno.readTextFileSync(
      resourcePath("editor/tools/yaml/quarto-json-schemas.json"),
    ),
  ) as QuartoJsonSchemas);

  const schemaDefs = getSchemas().definitions;
  for (const [_key, value] of Object.entries(schemaDefs)) {
    setSchemaDefinition(value);
  }
}
