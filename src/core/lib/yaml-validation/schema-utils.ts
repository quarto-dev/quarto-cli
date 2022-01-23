/*
* schema-utils.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Schema, schemaType } from "./schema.ts";
import { prefixes } from "../regexp.js";

// FIXME typings for quarto-json-schemas.json
export interface QuartoJsonSchemas {
  schemas: {
    "front-matter": Schema;
    config: Schema;
    engines: Schema; // FIXME engines is not a single schema!!
  };
  aliases: Record<string, string[]>;
  definitions: Record<string, Schema>;
}

let _schemas: QuartoJsonSchemas | undefined;

// this is an escape hatch for the quarto CLI to install the schema
// files appropriately.
export function setSchemas(schemas: QuartoJsonSchemas) {
  _schemas = schemas;
}

// FIXME no longer needs to be async
// deno-lint-ignore require-await
export function getSchemas(): QuartoJsonSchemas {
  if (_schemas) {
    return _schemas;
  } else {
    throw new Error("Internal error: schemas not set");
  }
}

function matchPatternProperties(schema: Schema, key: string): Schema | false {
  for (
    const [regexpStr, subschema] of Object.entries(
      schema.patternProperties || {},
    )
  ) {
    const prefixPattern = prefixes(new RegExp(regexpStr)) as RegExp;
    if (key.match(prefixPattern)) {
      return subschema;
    }
  }
  return false;
}

export function navigateSchema(
  schema: Schema,
  path: (number | string)[]
): Schema[]
{
  const inner = (subSchema: Schema, index: number): Schema[] => {
    subSchema = resolveSchema(subSchema);
    if (index === path.length) {
      return [subSchema];
    }
    const st = schemaType(subSchema);
    if (st === "object") {
      const key = path[index] as string;
      // does it match a properties key exactly? use it
      if (subSchema.properties && subSchema.properties[key]) {
        return inner(subSchema.properties[key], index + 1);
      }
      // does the key match a regular expression in a patternProperties key? use it
      const patternPropMatch = matchPatternProperties(subSchema, key);
      if (patternPropMatch) {
        return inner(patternPropMatch, index + 1);
      }

      // because we're using this in an autocomplete scenario, there's the "last entry is a prefix of a
      // valid key" special case.
      if (index !== path.length - 1) {
        return [];
      }
      const completions = Object.getOwnPropertyNames(subSchema.properties || {})
        .filter(
          (name) => name.startsWith(key),
        );
      if (completions.length === 0) {
        return [];
      }
      return [subSchema];
    } else if (st === "array") {
      // arrays are uniformly typed, easy, and we don't even need to use the path value.
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map((ss: Schema) => inner(ss, index));
    } else if (st === "allOf") {
      return subSchema.allOf.map((ss: Schema) => inner(ss, index));
    } else if (st === "oneOf") {
      return subSchema.oneOf.map((ss: Schema) => inner(ss, index));
    } else {
      // if path wanted to navigate deeper but this is a YAML
      // "terminal" (not a compound type) then this is not a valid
      // schema to complete on.
      return [];
    }
  };
  return inner(schema, 0).flat(Infinity);
}

export function resolveSchema(schema: Schema) {
  // common fast path
  if (schema.$ref === undefined) {
    return schema;
  }
  
  const { definitions } = getSchemas();
  
  // this is on the chancy side of clever, but we're going to be extra
  // careful here and use the cycle-detecting trick. This code runs
  // in the IDE and I _really_ don't want to accidentally freeze them.
  
  let cursor1: Schema = schema;
  let cursor2: Schema = schema;
  const next = (cursor: Schema) => {
    const result = definitions[cursor.$ref];
    if (result === undefined) {
      throw new Error(`Internal Error: ref ${cursor.$ref} not in definitions`);
    }
    return result;
  }

  while (cursor1.$ref !== undefined) {
    cursor1 = next(cursor1);
    if (cursor1.$ref === undefined) {
      return cursor1;
    }
    cursor2 = next(cursor2);
    if (cursor2.$ref === undefined) {
      return cursor2;
    }
    cursor2 = next(cursor2);
    if (cursor2.$ref === undefined) {
      return cursor2;
    }
    if (cursor1.$ref === cursor2.$ref) {
      throw new Error(`reference cycle detected at ${cursor1.$ref}`);
    }
  }
  
  return cursor1;
}
