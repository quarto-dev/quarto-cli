/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema } from "../lib/yaml-validation/schema.ts";

import { expandFormatAliases } from "./format-aliases.ts";

import {
  objectRefSchemaFromContextGlob,
  SchemaField,
  schemaFromField,
} from "./from-yaml.ts";

import { anyOfSchema as anyOfS, enumSchema as enumS } from "./common.ts";

import { ConcreteSchema } from "../lib/yaml-validation/validator/types.ts";

function useSchema(schema: ConcreteSchema, format: string) {
  const formats = schema?.tags?.formats as string[] | undefined;
  if (formats === undefined) {
    return true;
  }
  const disabled = formats.filter((f) => f.startsWith("!")).map((f) =>
    f.slice(1)
  );
  const enabled = formats.filter((f) => !f.startsWith("!"));
  if (
    disabled.length > 0 &&
    expandFormatAliases(disabled).indexOf(format) !== -1
  ) {
    return false;
  }
  if (
    enabled.length > 0 &&
    expandFormatAliases(enabled).indexOf(format) === -1
  ) {
    return false;
  }
  return true;
}

// FIXME who's using this thing that isn't behind a defineCached call?
export function getFormatSchema(format: string): Schema {
  const schema = objectRefSchemaFromContextGlob(
    "document-*",
    (field: SchemaField) => {
      const schema = schemaFromField(field);
      return useSchema(schema, format);
    },
  );

  return anyOfS(schema, enumS("default"));
}
