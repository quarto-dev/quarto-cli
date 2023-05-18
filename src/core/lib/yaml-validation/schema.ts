/*
 * schema.ts
 *
 * JSON Schema core definitions
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { InternalError } from "../error.ts";
import {
  AllOfSchema,
  AnyOfSchema,
  ConcreteSchema,
  Schema,
  schemaType,
} from "../yaml-schema/types.ts";

export function schemaAccepts(schema: Schema, testType: string): boolean {
  const t = schemaType(schema);
  if (t === testType) {
    return true;
  }
  switch (t) {
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

export function schemaExhaustiveCompletions(schema: Schema): boolean {
  switch (schemaType(schema)) {
    case "false":
      return true;
    case "true":
      return true;
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.every(schemaExhaustiveCompletions);
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
    throw new InternalError(`Schema ${key} not found.`);
  }
  return definitionsObject[key];
}

export function setSchemaDefinition(schema: ConcreteSchema) {
  if (schema.$id === undefined) {
    throw new InternalError(
      "setSchemaDefinition needs $id",
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
        throw new InternalError(
          `${el} doesn't have an entry in the aliases map`,
        );
      }
      lst.push(...v);
    } else {
      result.push(el);
    }
  }
  return result;
}
