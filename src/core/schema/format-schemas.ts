/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema } from "../lib/schema.ts";

import { expandFormatAliases } from "./format-aliases.ts";

import {
  SchemaField,
  schemaFromField,
  objectRefSchemaFromContextGlob,
} from "./from-yaml.ts";

import {
  enumSchema as enumS,
  oneOfSchema as oneOfS,
} from "./common.ts";

function useSchema(schema: Schema, format: string) {
  const formats = schema?.tags?.formats as string[] | undefined;
  if (formats === undefined)
    return true;
  const disabled = formats.filter(f => f.startsWith("!")).map(f => f.slice(1));
  const enabled = formats.filter(f => !f.startsWith("!"));
  if (disabled.length > 0 &&
    expandFormatAliases(disabled).indexOf(format) !== -1) {
    return false;
  }
  if (enabled.length > 0 &&
    expandFormatAliases(enabled).indexOf(format) === -1) {
    return false;
  }
  return true;
}

export function getFormatSchema(format: string): Schema
{
  const schema = objectRefSchemaFromContextGlob(
    "document-*",
    (field: SchemaField) => {
      const schema = schemaFromField(field);
      return useSchema(schema, format);
    });
  
  return oneOfS(schema, enumS("default"));
}
