/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema } from "../lib/schema.ts";

import { schemaPath } from "./utils.ts";

import { expandFormatAliases } from "./format-aliases.ts";

import {
  SchemaField,
  schemaFromField,
  convertFromYaml,
  objectRefSchemaFromContextGlob,
} from "./from-yaml.ts";

import {
  readAndValidateYamlFromFile,
  ValidationError,
} from "./validated-yaml.ts";

import { readYaml } from "../yaml.ts";

import { resourcePath } from "../resources.ts";

import { error } from "log/mod.ts";

import {
  documentSchema,
  refSchema,
  enumSchema as enumS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
} from "./common.ts";

import {
  expandGlobSync
} from "fs/expand_glob.ts";

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
};

export function getFormatSchema(format: string): Schema
{
  const schema = objectRefSchemaFromContextGlob(
    "document-*",
    (field: SchemaField) => {
      let schema = schemaFromField(field);
      return useSchema(schema, format);
    });
  
  return oneOfS(schema, enumS("default"));
}
