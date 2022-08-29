/*
* create-schema-types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { generateTypesFromSchemas } from "../../../src/core/schema/types-from-schema.ts";

await generateTypesFromSchemas(Deno.args[0]);
