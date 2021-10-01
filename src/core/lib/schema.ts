/*
* schema.ts
*
* JSON Schema core definitions
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

export type Schema = any;

export function schemaType(schema: Schema)
{
  const t = schema.type;
  if (t)
    return t;
  if (schema.anyOf) {
    return "anyOf";
  }
  if (schema.oneOf) {
    return "oneOf";
  }
  if (schema.allOf) {
    return "allOf";
  }
  if (schema.enum) {
    return "enum";
  }
  return "any";
}

export function schemaCompletions(schema: Schema): string[]
{
  if (schema.completions)
    return schema.completions as string[];
  
  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        return schemaCompletions(schema.items);
      } else {
        return [];
      }
    case "anyOf":
      return schema.anyOf.map(schemaCompletions).flat() as string[];
    case "oneOf":
      return schema.oneOf.map(schemaCompletions).flat() as string[];
    case "allOf": // FIXME this should be cleverer and keep only the intersection
      return schema.allOf.map(schemaCompletions).flat() as string[];
    default:
      return [];
  }
}

export function walkSchema<T>(schema: Schema, f: (a: Schema) => T)
{
  f(schema);
  
  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        walkSchema(schema.items, f);
      };
      break;
    case "anyOf":
      for (const s of schema.anyOf) {
        walkSchema(s, f);
      }
      break;
    case "oneOf":
      for (const s of schema.oneOf) {
        walkSchema(s, f);
      }
      break;
    case "allOf":
      for (const s of schema.allOf) {
        walkSchema(s, f);
      }
      break;
    case "object":
      if (schema.properties) {
        for (const key of Object.getOwnPropertyNames(schema.properties)) {
          const s = schema.properties[key];
          walkSchema(s, f);
        }
      }
      if (schema.additionalProperties) {
        walkSchema(schema.additionalProperties, f);
      }
      break;
  }
}

/**
* normalizeSchema takes our version of a "json schema" (which includes
* extra fields for autocomplete etc) and builds an actual JSON Schema
* object that passes ajv's strict mode.
*/

export function normalizeSchema(schema: Schema): Schema
{
  // FIXME this deep copy can probably be made more efficient
  const result = JSON.parse(JSON.stringify(schema));
  
  walkSchema(result, (schema) => {
    if (schema.completions) {
      delete schema.completions;
    }
    if (schema.documentation) {
      delete schema.documentation;
    }
  });

  return result;
}
