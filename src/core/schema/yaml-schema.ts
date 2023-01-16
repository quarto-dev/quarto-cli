/*
* yaml-schema.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

// FIXME needs refactoring. This is mostly only used at build-js time,
// except for "parseAndValidate".

import { YAMLSchema } from "../lib/yaml-validation/yaml-schema.ts";
import { MappedString } from "../lib/text-types.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { loadDefaultSchemaDefinitions } from "../lib/yaml-schema/definitions.ts";
import { expandGlobSync } from "../deno/expand-glob.ts";
import { resourcePath } from "../resources.ts";
import { readYaml } from "../yaml.ts";
import { JSONValue } from "../lib/yaml-schema/types.ts";
import { setYamlIntelligenceResources } from "../lib/yaml-intelligence/resources.ts";
import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";

let schemaResourcesLoaded = false;

export async function ensureSchemaResources() {
  if (!schemaResourcesLoaded) {
    schemaResourcesLoaded = true;
    const resources: Record<string, JSONValue> = {};
    for (const walk of expandGlobSync(resourcePath("schema/*.yml"))) {
      resources[`schema/${walk.name}`] = readYaml(walk.path) as JSONValue;
    }
    resources[`pandoc/formats.yml`] = await pandocListFormats();
    setYamlIntelligenceResources(resources);

    await loadDefaultSchemaDefinitions();
  }
}

// This function isn't in YAMLSchema because
// readAnnotatedYamlFromMappedString depends on a yaml library we do
// not use on core/lib
//
// FIXME not anymore, so move this.
export async function parseAndValidate(
  src: MappedString,
  validator: YAMLSchema,
) {
  const parse = readAnnotatedYamlFromMappedString(src)!;
  return await validator.validateParse(src, parse);
}
