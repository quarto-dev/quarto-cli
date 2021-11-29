/*
* build-schema-file.ts
*
* Collects the existing schemas and builds a single JSON file with
* their description
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { frontMatterSchema } from "./front-matter.ts";
import { configSchema } from "./config.ts";
import { languageOptionsSchema } from "./chunk-metadata.ts";
import { join } from "path/mod.ts";

const obj = {
  schemas: {
    "front-matter": frontMatterSchema,
    "config": configSchema,
    "languages": languageOptionsSchema,
  },
};

export function buildSchemaFile(resourceDir: string) {
  const str = JSON.stringify(obj, null, 2);
  const path = join(resourceDir, "/editor/tools/yaml/quarto-json-schemas.json");

  return Deno.writeTextFile(path, str);
}
