/*
* create-schema-types.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  generateTypesFromSchemas, 
  generateSchemaTypes,
} from "../../../src/core/schema/types-from-schema.ts";

import {
  generateJsonSchemasFromSchemas,
} from "../../../src/core/schema/json-schema-from-schema.ts";

await generateTypesFromSchemas(Deno.args[0]);
await generateSchemaTypes(Deno.args[0]);
await generateJsonSchemasFromSchemas(Deno.args[0]);