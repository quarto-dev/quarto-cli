/*
* create-schema-types.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  generateTypesFromSchemas, 
  generateSchemaTypes,
  generateJsonSchemas,
} from "../../../src/core/schema/types-from-schema.ts";

await generateTypesFromSchemas(Deno.args[0]);
await generateSchemaTypes(Deno.args[0]);
// await generateJsonSchemas(Deno.args[0]);
