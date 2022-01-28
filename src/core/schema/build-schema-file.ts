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
import { resourcePath } from "../resources.ts";
import {
  getSchemas,
  QuartoJsonSchemas,
} from "../lib/yaml-validation/schema-utils.ts";
import {
  getSchemaDefinitionsObject,
  setSchemaDefinition,
} from "../lib/yaml-validation/schema.ts";
import { exportStandaloneValidators } from "./yaml-schema.ts";
import { getFormatAliases } from "./format-aliases.ts";
import { TempContext } from "../temp.ts";
import { ensureAjv } from "./yaml-schema.ts";
import { revealPluginSchema } from "../../format/reveal/format-reveal-plugin.ts";

export async function buildSchemaFile(temp: TempContext) {
  await ensureAjv();
  const obj = getSchemas();
  obj.aliases = getFormatAliases();
  obj.schemas["front-matter"] = await getFrontMatterSchema();
  obj.schemas.config = await getProjectConfigSchema();
  obj.schemas.engines = await getEngineOptionsSchema();
  setSchemaDefinition(revealPluginSchema);
  obj.definitions = getSchemaDefinitionsObject();
  const str = JSON.stringify(obj);
  const path = resourcePath("/editor/tools/yaml/quarto-json-schemas.json");

  const validatorPath = resourcePath(
    "/editor/tools/yaml/standalone-schema-validators.js",
  );
  const validatorModule = await exportStandaloneValidators(temp);

  Deno.writeTextFileSync(validatorPath, validatorModule);
  return Deno.writeTextFile(path, str);
}
