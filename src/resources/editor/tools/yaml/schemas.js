/*
* schemas.js
* 
* Copyright (C) 2021 by RStudio, PBC
*
*/


import * as core from "../../../build/core-lib.js";
import { getLocalPath } from "./paths.js";

let _schemas;

export async function getSchemas() {
  if (_schemas) {
    return _schemas;
  }
  const response = await fetch(getLocalPath("quarto-json-schemas.json"));
  _schemas = response.json();
  return _schemas;
}

function matchPatternProperties(schema, key)
{
  for (const [regexpStr, subschema] of Object.entries(schema.patternProperties || {})) {
    const prefixPattern = core.prefixes(new RegExp(regexpStr));
    if (key.match(prefixPattern)) {
      return subschema;
    }
  }
  return false;
}

export async function navigateSchema(schema, path) {
  const refs = {};
  const { definitions } = await getSchemas();
  
  function inner(subSchema, index) {
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
    const st = core.schemaType(subSchema);
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
