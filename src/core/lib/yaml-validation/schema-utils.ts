/*
* schema-utils.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Schema, schemaType, Completion, getSchemaDefinition } from "./schema.ts";
import { prefixes } from "../regexp.js";

// NB: QuartoJsonSchemas is meant for serialization of the entire body of schemas
// For actual schema use in quarto, use either the definitions in core/schema
// or call getSchemaDefinition(). _in particular_, the definitions field in _schemas
// might be stale!
//
// TODO this probably needs a good refactoring, but you've been warned.

// TODO typings for quarto-json-schemas.json
export interface QuartoJsonSchemas {
  schemas: {
    "front-matter": Schema;
    config: Schema;
    engines: Schema; // FIXME engines is not a single schema!!
  };
  aliases: Record<string, string[]>;
  definitions: Record<string, Schema>;
}

let _schemas: QuartoJsonSchemas = {
  schemas: {
    "front-matter": undefined,
    config: undefined,
    engines: undefined
  },
  aliases: {},
  definitions: {}
};

// this is an escape hatch for the quarto CLI to install the schema
// files appropriately.
export function setSchemas(schemas: QuartoJsonSchemas) {
  _schemas = schemas;
}

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

// Note that we have _two_ schema navigation functions which behave
// differently.
//
// navigateSchema is used to resolve inner schema in error messages it
// navigates to sets of schema from the schema path given by ajv

export function navigateSchema(
  schema: Schema,
  path: (number | string)[],
): Schema[] {
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

// in contrast to navigateSchema, navigateSchemaSingle returns always
// a single schema.  It is used to walk the actual concrete schemas ("take
// _this specific anyOf_ entry, then that specific key", and give me
// the resulting schema")

export function navigateSchemaSingle(schema: Schema, path: (number | string)[]): Schema
{
  const ensurePathFragment = (fragment: (number | string), expected: (number | string)) => {
    if (fragment !== expected) {
      throw new Error(`Internal Error in navigateSchemaSingle: ${fragment} !== ${expected}`);
    }
  }
  
  const inner = (subschema: Schema, index: number): Schema => {
    if (subschema === undefined) {
      throw new Error(`Internal Error in navigateSchemaSingle: invalid path navigation`);
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
      case "oneOf":
        ensurePathFragment(path[index], "oneOf");
        return inner(subschema.oneOf[path[index + 1]], index + 2);
      case "arrayOf":
        ensurePathFragment(path[index], "arrayOf");
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
          throw new Error(`Internal Error in navigateSchemaSingle: bad path fragment ${path[index]} in object navigation`);
        }
      default:
        throw new Error(`Internal Error in navigateSchemaSingle: can't navigate schema type ${st}`);
    }
  }
}

export function maybeResolveSchema(schema: Schema): Schema | undefined {
  try {
    return resolveSchema(schema);
  } catch (e) {
    return undefined;
  }
}

export function resolveDescription(s: string | { $ref: string }): string
{
  if (typeof s === "string") {
    return s;
  }
  const valueS = resolveSchema(s.$ref);
  if (valueS.documentation) {
    if (valueS.documentation.short) {
      return valueS.documentation.short as string;
    } else {
      return valueS.documentation as string;
    }
  } else {
    return "";
  }
}

export function resolveSchemaThroughFunction(
  schema: Schema,
  hasRef: (schema: Schema) => boolean,
  next: (schema: Schema) => Schema): Schema
{
  if (!hasRef(schema)) {
    return schema;
  }
  
  // this is on the chancy side of clever, but we're going to be extra
  // careful here and use the cycle-detecting trick. This code runs
  // in the IDE and I _really_ don't want to accidentally freeze them.
  //
  // I'm sufficiently dismayed by badly-written emacs modes that randomly
  // freeze on me from some unforeseen looping condition that I want
  // to go out of my way to avoid this for our users.

  let cursor1: Schema = schema;
  let cursor2: Schema = schema;

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

export function resolveSchema(schema: Schema) {
  // common fast path
  if (schema.$ref === undefined) {
    return schema;
  }

  const hasRef = (cursor: Schema) => {
    return cursor.$ref !== undefined;
  }
  
  const next = (cursor: Schema) => {
    const result = getSchemaDefinition(cursor.$ref);
    if (result === undefined) {
      throw new Error(`Internal Error: ref ${cursor.$ref} not in definitions`);
    }
    return result;
  };

  return resolveSchemaThroughFunction(schema, hasRef, next);
}

export function schemaCompletions(schema: Schema): Completion[] {
  // first resolve through $ref
  schema = resolveSchema(schema);

  // then resolve through "complete-from" schema tags
  schema = resolveSchemaThroughFunction(
    schema,
    (schema: Schema) => {
      return schema.tags && schema.tags["complete-from"];
    },
    (schema: Schema) => {
      return navigateSchemaSingle(schema, schema.tags["complete-from"]);
    }
  );
  
  // TODO this is slightly inefficient since recursions call
  // normalize() multiple times

  // deno-lint-ignore no-explicit-any
  const normalize = (completions: any) => {
    // deno-lint-ignore no-explicit-any
    const result = (completions || []).map((c: any) => {
      if (typeof c === "string") {
        return {
          type: "value",
          display: c,
          value: c,
          description: "",
          suggest_on_accept: false,
          schema,
        };
      }
      return {
        ...c,
        description: resolveDescription(c.description),
        schema,
      };
    });
    return result;
  };
  
  if (schema.completions && schema.completions.length) {
    return normalize(schema.completions);
  }

  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        return schemaCompletions(schema.items);
      } else {
        return [];
      }
    case "anyOf":
      return schema.anyOf.map(schemaCompletions).flat();
    case "oneOf":
      return schema.oneOf.map(schemaCompletions).flat();
    case "allOf":
      return schema.allOf.map(schemaCompletions).flat();
    default:
      return [];
  }
}
