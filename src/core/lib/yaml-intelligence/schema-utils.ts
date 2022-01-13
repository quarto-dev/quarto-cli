/*
* schemas.ts
* 
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Schema, schemaType } from "../schema.ts";
import { prefixes } from "../regexp.js";
import { getLocalPath } from "./paths.ts";

// FIXME typings for quarto-json-schemas.json
export interface QuartoJsonSchemas {
  schemas: {
    "front-matter": Schema;
    config: Schema;
    engines: Schema;
  };
  aliases: Record<string, string[]>;
  definitions: Record<string, Schema>;
};

let _schemas: QuartoJsonSchemas | undefined;

export async function getSchemas(): Promise<QuartoJsonSchemas> {
  if (_schemas) {
    return _schemas;
  }
  const response = await fetch(getLocalPath("quarto-json-schemas.json"));
  _schemas = response.json();
  return _schemas!;
}

function matchPatternProperties(schema: Schema, key: string): Schema | false
{
  for (const [regexpStr, subschema] of Object.entries(schema.patternProperties || {})) {
    const prefixPattern = prefixes(new RegExp(regexpStr)) as RegExp;
    if (key.match(prefixPattern)) {
      return subschema;
    }
  }
  return false;
}

export async function navigateSchema(schema: Schema, path: string): Schema[] {
  const refs: Record<string, Schema> = {};
  const { definitions } = await getSchemas();
  
  const inner = (subSchema, index) => {
    if (subSchema.$id) {
      refs[subSchema.$id] = subSchema;
    }
    if (subSchema.$ref) {
      if (refs[subSchema.$ref]) {
        subSchema = refs[subSchema.$ref];
      } else if (definitions[subSchema.$ref]) {
        subSchema = definitions[subSchema.$ref];
      } else {
        throw new Error(
          `Internal error: schema reference ${subSchema.$ref} not found in internal refs or definitions`,
        );
      }
    }
    if (index === path.length) {
      return [subSchema];
    }
    const st = schemaType(subSchema);
    if (st === "object") {
      const key = path[index];
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
      // arrays are uniformly typed, easy
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map((ss) => inner(ss, index));
    } else if (st === "allOf") {
      return subSchema.allOf.map((ss) => inner(ss, index));
    } else if (st === "oneOf") {
      return subSchema.oneOf.map((ss) => inner(ss, index));
    } else {
      // if path wanted to navigate deeper but this is a YAML
      // "terminal" (not a compound type) then this is not a valid
      // schema to complete on.
      return [];
    }
  }
  return inner(schema, 0).flat(Infinity);
}
