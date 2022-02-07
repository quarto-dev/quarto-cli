/*
* schema.ts
*
* JSON Schema core definitions
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  AllOfSchema,
  AnyOfSchema,
  ArraySchema,
  Completion,
  ConcreteSchema,
  ObjectSchema,
  OneOfSchema,
  Schema,
  schemaType,
} from "./validator/types.ts";

export type { Completion, Schema } from "./validator/types.ts";
export { schemaType } from "./validator/types.ts";

// export interface Completion {
//   display: string;
//   type: "key" | "value";
//   value: string;
//   description: string | { $ref: string };
//   // deno-lint-ignore camelcase
//   suggest_on_accept: boolean;
//   // `schema` stores the concrete schema that yielded the completion.
//   // We need to carry it explicitly because of combinators like oneOf
//   schema?: Schema;
//   // the manually-generated documentation for the completion, if it exists
//   documentation?: string;
// }

export function schemaAccepts(schema: Schema, testType: string): boolean {
  const t = schemaType(schema);
  if (t === testType) {
    return true;
  }
  switch (t) {
    case "oneOf":
      return (schema as OneOfSchema).oneOf.some((s: Schema) =>
        schemaAccepts(s, testType)
      );
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.some((s: Schema) =>
        schemaAccepts(s, testType)
      );
    case "allOf":
      return (schema as AllOfSchema).allOf.every((s: Schema) =>
        schemaAccepts(s, testType)
      );
  }
  return false;
}

export function schemaAcceptsScalar(schema: Schema): boolean {
  const t = schemaType(schema);
  if (["object", "array"].indexOf(t) !== -1) {
    return false;
  }
  switch (t) {
    case "oneOf":
      return (schema as OneOfSchema).oneOf.some((s: Schema) =>
        schemaAcceptsScalar(s)
      );
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.some((s: Schema) =>
        schemaAcceptsScalar(s)
      );
    case "allOf":
      return (schema as AllOfSchema).allOf.every((s: Schema) =>
        schemaAcceptsScalar(s)
      );
  }
  return true;
}

// export function schemaType(schema: Schema): string {
//   const t = schema.type;
//   if (t) {
//     return t as string;
//   }
//   if (schema.anyOf) {
//     return "anyOf";
//   }
//   if (schema.oneOf) {
//     return "oneOf";
//   }
//   if (schema.allOf) {
//     return "allOf";
//   }
//   if (schema.enum) {
//     return "enum";
//   }
//   return "any";
// }

export function schemaExhaustiveCompletions(schema: Schema): boolean {
  switch (schemaType(schema)) {
    case "false":
      return true;
    case "true":
      return true;
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.every(schemaExhaustiveCompletions);
    case "oneOf":
      return (schema as OneOfSchema).oneOf.every(schemaExhaustiveCompletions);
    case "allOf":
      return (schema as AllOfSchema).allOf.every(schemaExhaustiveCompletions);
    case "array":
      return true;
    case "object":
      return true;
    default:
      return (schema as ConcreteSchema).exhaustiveCompletions || false;
  }
}

const definitionsObject: Record<string, ConcreteSchema> = {};

export function hasSchemaDefinition(key: string): boolean {
  return definitionsObject[key] !== undefined;
}

export function getSchemaDefinition(key: string): ConcreteSchema {
  if (definitionsObject[key] === undefined) {
    throw new Error(`Internal Error: Schema ${key} not found.`);
  }
  return definitionsObject[key];
}

export function setSchemaDefinition(schema: ConcreteSchema) {
  if (schema.$id === undefined) {
    throw new Error(
      "Internal Error, setSchemaDefinition needs $id",
    );
  }
  // FIXME it's possible that without ajv we actually want to reset
  // schema definitions
  if (definitionsObject[schema.$id] === undefined) {
    definitionsObject[schema.$id] = schema;
  }
}

export function getSchemaDefinitionsObject(): Record<
  string,
  ConcreteSchema
> {
  return Object.assign({}, definitionsObject);
}

export function expandAliasesFrom(
  lst: string[],
  defs: Record<string, string[]>,
): string[] {
  const aliases = defs;
  const result = [];

  lst = lst.slice();
  for (let i = 0; i < lst.length; ++i) {
    const el = lst[i];
    if (el.startsWith("$")) {
      const v = aliases[el.slice(1)];
      if (v === undefined) {
        throw new Error(
          `Internal Error: ${el} doesn't have an entry in the aliases map`,
        );
      }
      lst.push(...v);
    } else {
      result.push(el);
    }
  }
  return result;
}
