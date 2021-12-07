/*
* utils.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema, normalizeSchema } from "../lib/schema.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { ensureAjv } from "./yaml-schema.ts";

export function cacheSchemaFunction(
  name: string,
  maker: () => Promise<Schema>,
): ((normalized?: boolean) => Promise<Schema>) {
  
  const schemaCache: Record<string, Schema> = {};
  const schemaCacheNormalized: Record<string, Schema> = {};
  
  const getter = async (normalized?: boolean) => {
    if (normalized) {
      if (schemaCacheNormalized[name]) {
        return schemaCacheNormalized[name];
      }
      await ensureAjv();
      const schema = await getter();
      schemaCacheNormalized[name] = normalizeSchema(schema);
      return schemaCacheNormalized[name];
    } else {
      if (schemaCache[name]) {
        return schemaCache[name];
      }
      await ensureAjv();
      const schema = await maker();
      schemaCache[name] = schema;
      return schema;
    }
  };
  return getter;
}

export function schemaPath(path: string)
{
  return resourcePath(join("schema", path));
}
