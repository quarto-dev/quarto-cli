/*
* format-schemas.ts
*
* Functions to define JSON Schemas for quarto formats
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { expandFormatAliases } from "./format-aliases.ts";

import {
  objectRefSchemaFromContextGlob,
  SchemaField,
  schemaFromField,
} from "./from-yaml.ts";

import {
  anyOfSchema as anyOfS,
  enumSchema as enumS,
} from "../yaml-schema/common.ts";

import { ConcreteSchema, Schema } from "./types.ts";

function useSchema(schema: ConcreteSchema, format: string) {
  const formats = (schema && schema.tags && schema.tags.formats) as
    | string[]
    | undefined;
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
