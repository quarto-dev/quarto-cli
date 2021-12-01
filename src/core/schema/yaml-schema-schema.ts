/*
* yaml-schema-schema.ts
*
* Schemas to validate yaml schemas written in yaml.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readYaml } from "../yaml.ts";
import { convertFromYaml } from "./from-yaml.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { Schema } from "../lib/schema.ts";

export function getSchema()
{
  const yaml = readYaml(join(resourcePath(), "/schema/schema.yml")) as Record<string, any>[];
  const dict: Record<string, Schema> = {};
  return yaml.map(obj => {
    const result = convertFromYaml(obj, dict);
    if (result.$id) {
      dict[result.$id as string] = result;
    }
    return result;
  });
}
