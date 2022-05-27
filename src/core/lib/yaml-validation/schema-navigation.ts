/*
*
* schema-navigation.ts
*
* functions to navigate schema
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resolveSchema } from "./resolve.ts";

import { prefixes } from "../regexp.js";

import { schemaType } from "../yaml-schema/types.ts";

// NB we have _three_ schema navigation functions which behave
// differently and are needed in different cases

// navigateSchemaBySchemaPath is used to resolve inner schema in error
// messages. it navigates to sets of schema from the schema path given
// by ajv

// navigateSchemaByInstancePath is used to resolve inner schema via possible
// instance paths. It navigates to sets of schema from an _instance path_,
// returning the set of schema that could be navigated to by the particular
// sequence of keys (and array offsets)
export function navigateSchemaByInstancePath(
  // deno-lint-ignore no-explicit-any
  schema: any,
  path: (number | string)[],
  // deno-lint-ignore no-explicit-any
): any[] {
  // deno-lint-ignore no-explicit-any
  const inner = (subSchema: any, index: number): any[] => {
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
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return [];
      }
      // don't index into array with a string path.
      if (typeof path[index] === "string") {
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      // deno-lint-ignore no-explicit-any
      return subSchema.anyOf.map((ss: any) => inner(ss, index));
    } else if (st === "allOf") {
      // deno-lint-ignore no-explicit-any
      return subSchema.allOf.map((ss: any) => inner(ss, index));
    } else {
      // if path wanted to navigate deeper but this is a YAML
      // "terminal" (not a compound type) then this is not a valid
      // schema to complete on.
      return [];
    }
  };
  return inner(schema, 0).flat(Infinity);
}

// navigateSchemaBySchemaPathSingle returns always a single schema. It is used to
// walk the actual concrete schemas ("take _this specific anyOf_
// entry, then that specific key", and give me the resulting schema")
export function navigateSchemaBySchemaPathSingle(
  // deno-lint-ignore no-explicit-any
  schema: any,
  path: (number | string)[],
  // deno-lint-ignore no-explicit-any
): any {
  const ensurePathFragment = (
    fragment: (number | string),
    expected: (number | string),
  ) => {
    if (fragment !== expected) {
      throw new Error(
        `Internal Error in navigateSchemaBySchemaPathSingle: ${fragment} !== ${expected}`,
      );
    }
  };

  // deno-lint-ignore no-explicit-any
  const inner = (subschema: any, index: number): any => {
    subschema = resolveSchema(subschema);
    if (subschema === undefined) {
      throw new Error(
        `Internal Error in navigateSchemaBySchemaPathSingle: invalid path navigation`,
      );
    }
    if (index === path.length) {
      return subschema;
    }
    const st = schemaType(subschema);
    switch (st) {
      case "anyOf":
        ensurePathFragment(path[index], "anyOf");
        return inner(subschema.anyOf[path[index + 1]], index + 2);
      case "allOf":
        ensurePathFragment(path[index], "allOf");
        return inner(subschema.allOf[path[index + 1]], index + 2);
      case "array":
        ensurePathFragment(path[index], "array");
        return inner(subschema.arrayOf.schema, index + 2);
      case "object":
        ensurePathFragment(path[index], "object");
        if (path[index + 1] === "properties") {
          return inner(subschema.properties[path[index + 2]], index + 3);
        } else if (path[index + 1] === "patternProperties") {
          return inner(subschema.patternProperties[path[index + 2]], index + 3);
        } else if (path[index + 1] === "additionalProperties") {
          return inner(subschema.additionalProperties, index + 2);
        } else {
          throw new Error(
            `Internal Error in navigateSchemaBySchemaPathSingle: bad path fragment ${
              path[index]
            } in object navigation`,
          );
        }
      default:
        throw new Error(
          `Internal Error in navigateSchemaBySchemaPathSingle: can't navigate schema type ${st}`,
        );
    }
  };
  return inner(schema, 0);
}

// deno-lint-ignore no-explicit-any
function matchPatternProperties(schema: any, key: string): any | false {
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
