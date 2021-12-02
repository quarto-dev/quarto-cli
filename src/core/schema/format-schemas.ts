/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  Schema
} from "../lib/schema.ts";

import {
  getSchemaSchemas
} from "./yaml-schema-schema.ts";

import {
  resourcePath
} from "../resources.ts";

import {
  getExpandedFormatAliases,
  expandFormatAliases
} from "./format-aliases.ts";

import {
  convertFromYaml
} from "./from-yaml.ts";

import {
  readAndValidateYamlFromFile,
  ValidationError
} from "./validated-yaml.ts";

import {
  error
} from "log/mod.ts";

import {
  StringSchema as StringS,
  BooleanSchema as BooleanS,
  arraySchema as arrayOfS,
  oneOfSchema as oneOfS,
  anyOfSchema as anyOfS,
  objectSchema as objectS,
  enumSchema as enumS,
  idSchema as withId,
  documentSchema,
} from "./common.ts";

interface SchemaEntry {
  name: string;
  schema: Schema;
  hidden?: boolean;
  "default"?: any;
  alias?: string;
  disabled?: string[],
  enabled?: string[],
  description: string | {
    short: string,
    long: string
  },
}

export async function getFormatSchema(format: string): Promise<Schema>
{
  const aliases = getExpandedFormatAliases();
  const pandocFormats = aliases["pandoc-all"];
  const entries: SchemaEntry[] = [];

  try {
    entries.push(...((await readAndValidateYamlFromFile(
      resourcePath("schema/format-pandoc.yml"),
      { $id: "good" }, // schemaEntryFileSchema is killing ajv currently :(
      "schema entry file validation failed."
    )) as SchemaEntry[]));
  } catch (e) {
    error("\n");
    error(e);
    if (e instanceof ValidationError) {
      for (const err of e.validationErrors) {
        error(err.message);
        error(err.error.message);
        error("\n");
      }
    }
    throw e;
  }

  const useEntry = (entry: SchemaEntry) => {
    if (entry.disabled) {
      return expandFormatAliases(entry.disabled).indexOf(format) === -1;
    } else if (entry.enabled) {
      return expandFormatAliases(entry.enabled).indexOf(format) !== -1;
    }
    return true;
  }

  const properties: Record<string, Schema> = {};
  
  for (const entry of entries) {
    if (!useEntry(entry)) {
      continue;
    }
    let schema = convertFromYaml(entry.schema);
    
    // pick documentation from entry (the in-schema documentation has
    // already been handled by convertFromYaml)
    
    if (entry.description) {
      if (typeof entry.description === "string") {
        schema = documentSchema(schema, entry.description);
      } else if (typeof entry.description === "object") {
        schema = documentSchema(schema, entry.description.short);
      }
    }
    properties[entry.name] = schema;
  }
  return oneOfS(
    objectS({
      properties
    }),
    enumS("default")
  );
}
