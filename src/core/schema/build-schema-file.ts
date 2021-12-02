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
import { readYaml } from "../yaml.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { idSchema } from "./common.ts";
import { normalizeSchema, Schema } from "../lib/schema.ts";
import { convertFromYaml } from "./from-yaml.ts";

export async function buildSchemaFile(resourceDir: string) {
  let yamlDefinitions = readYaml(resourcePath("/schema/definitions.yml")) as Record<string, any>;
  const defObj: Record<string, Schema> = {};
  for (const [name, yamlSchema] of Object.entries(yamlDefinitions)) {
    defObj[name] = normalizeSchema(idSchema(convertFromYaml(yamlSchema), name));
  }
  const obj = {
    schemas: {
      "front-matter": await getFrontMatterSchema(),
      "config": await getConfigSchema(),
      "languages": await getLanguageOptionsSchema(),
    },
    definitions: defObj
  };
  const str = JSON.stringify(obj, null, 2);
  const path = join(resourceDir, "/editor/tools/yaml/quarto-json-schemas.json");

  return Deno.writeTextFile(path, str);
}
