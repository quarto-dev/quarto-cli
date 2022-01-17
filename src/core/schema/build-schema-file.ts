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
import { resourcePath } from "../resources.ts";
import { idSchema } from "./common.ts";
import { normalizeSchema, Schema, setSchemaDefinition, getSchemaDefinitionsObject } from "../lib/schema.ts";
import { exportStandaloneValidators } from "./yaml-schema.ts";
import { convertFromYaml } from "./from-yaml.ts";
import { getFormatAliases } from "./format-aliases.ts";
import { TempContext } from "../temp.ts";

export async function buildSchemaFile(temp: TempContext) {
  const frontMatter = await getFrontMatterSchema();
  const config = await getProjectConfigSchema();
  const engines = await getEngineOptionsSchema();
  const obj = {
    schemas: {
      "front-matter": frontMatter,
      config,
      engines,
    },
    definitions: getSchemaDefinitionsObject(),
    aliases: getFormatAliases()
  };
  const str = JSON.stringify(obj);
  const path = resourcePath("/editor/tools/yaml/quarto-json-schemas.json");
  
  const validatorPath = resourcePath("/editor/tools/yaml/standalone-schema-validators.js");
  const validatorModule = await exportStandaloneValidators(temp);

  Deno.writeTextFileSync(validatorPath, validatorModule);
  return Deno.writeTextFile(path, str);
}
