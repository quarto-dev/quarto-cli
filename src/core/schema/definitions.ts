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
import { normalizeSchema } from "../lib/schema.ts";

export function loadDefaultSchemaDefinitions()
{
  return loadSchemaDefinitions(resourcePath("schema/definitions.yml"));
}

export async function loadSchemaDefinitions(file: string)
{
  let yaml = readYaml(file) as Record<string, any>;
  await ensureAjv();
  await Promise.all(Object.entries(yaml).map(async ([name, yamlSchema]) => {
    const schema = normalizeSchema(idSchema(convertFromYaml(yamlSchema), name));
    await withValidator(schema, (_validator) => {
      return;
    });
  }));
}
