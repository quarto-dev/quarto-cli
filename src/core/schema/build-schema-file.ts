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
import { getProjectConfigSchema } from "./project-config.ts";
import { getEngineOptionsSchema } from "./chunk-metadata.ts";
import { readYaml } from "../yaml.ts";
import { schemaPath } from "./utils.ts";
import { join } from "path/mod.ts";
import { idSchema } from "./common.ts";
import { normalizeSchema, Schema, setSchemaDefinition, getSchemaDefinitionsObject } from "../lib/schema.ts";
import { convertFromYaml } from "./from-yaml.ts";

export async function buildSchemaFile(resourceDir: string) {
  const yamlDefinitions = readYaml(schemaPath("definitions.yml")) as any[];
  for (const yamlSchema of yamlDefinitions) {
    const schema = normalizeSchema(convertFromYaml(yamlSchema));
    setSchemaDefinition(schema);
  }
  const obj = {
    schemas: {
      "front-matter": await getFrontMatterSchema(),
      "config": await getProjectConfigSchema(),
      "engines": await getEngineOptionsSchema(),
    },
    definitions: getSchemaDefinitionsObject()
  };
  const str = JSON.stringify(obj, null, 2);
  const path = join(resourceDir, "/editor/tools/yaml/quarto-json-schemas.json");

  return Deno.writeTextFile(path, str);
}
