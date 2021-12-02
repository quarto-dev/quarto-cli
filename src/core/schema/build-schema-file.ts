/*
* build-schema-file.ts
*
* Collects the existing schemas and builds a single JSON file with
* their description
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { getFrontMatterSchema } from "./front-matter.ts";
import { getConfigSchema } from "./config.ts";
import { getLanguageOptionsSchema } from "./chunk-metadata.ts";
import { join } from "path/mod.ts";

export async function buildSchemaFile(resourceDir: string) {
  const obj = {
    schemas: {
      "front-matter": await getFrontMatterSchema(),
      "config": await getConfigSchema(),
      "languages": await getLanguageOptionsSchema(),
    },
  };
  const str = JSON.stringify(obj, null, 2);
  const path = join(resourceDir, "/editor/tools/yaml/quarto-json-schemas.json");

  return Deno.writeTextFile(path, str);
}
