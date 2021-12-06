/*
* definitions.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { withValidator } from "../lib/validator-queue.ts";
import { resourcePath } from "../resources.ts";
import { convertFromYaml } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
import { readYaml } from "../yaml.ts";
import { ensureAjv } from "./yaml-schema.ts";
import { normalizeSchema, Schema, setSchemaDefinition } from "../lib/schema.ts";
import { error } from "log/mod.ts";

export function loadDefaultSchemaDefinitions()
{
  return loadSchemaDefinitions(resourcePath("schema/definitions.yml"));
}

export async function loadSchemaDefinitions(file: string)
{
  let yaml = readYaml(file) as any[];

  await ensureAjv();
  await Promise.all(yaml.map(async (yamlSchema) => {
    const schema = normalizeSchema(convertFromYaml(yamlSchema));
    if (schema.$id === undefined) {
      console.log(JSON.stringify(yamlSchema, null, 2));
      error(JSON.stringify(schema, null, 2));
      throw new Error(`Internal error: unnamed schema in definitions`);
    }
    await withValidator(schema, (_validator) => {
      setSchemaDefinition(schema);
    });
  }));
}
