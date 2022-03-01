/*
* yaml-schema-schema.ts
*
* Schemas to validate yaml schemas written in yaml.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { convertFromYaml } from "./from-yaml.ts";
import { setSchemaDefinition } from "../yaml-validation/schema.ts";
import { ConcreteSchema, Schema } from "../yaml-schema/types.ts";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.ts";

export function getSchemaSchemas(): Record<string, Schema> {
  const yaml = getYamlIntelligenceResource("schema/schema.yml") as Record<
    string,
    // deno-lint-ignore no-explicit-any
    any
  >[];
  const dict: Record<string, Schema> = {};
  for (const obj of yaml) {
    const schema = convertFromYaml(obj) as ConcreteSchema;
    setSchemaDefinition(schema);
    dict[schema.$id!] = schema;
  }
  return dict;
}
