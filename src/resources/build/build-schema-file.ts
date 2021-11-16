/*
* build-schema-file.ts
*
* Collects the existing schemas and builds a single JSON file with
* their description
* 
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { frontMatterSchema } from "../../core/schema/front-matter.ts";
import { configSchema } from "../../core/schema/config.ts";
import { languageOptionsValidators } from "../../core/schema/chunk-metadata.ts";
import { join } from "path/mod.ts";

const obj = {
  schemas: {
    "front-matter": frontMatterSchema,
    "config": configSchema,
    "languages": languageOptionsValidators
  }
};

export async function buildSchemaFile(resourceDir: string)
{
  const str = JSON.stringify(obj, null, 2);
  const path = join(resourceDir, "/editor/tools/yaml/quarto-json-schemas.json");

  Deno.writeTextFile(path, str);
}

