/*
* execute.ts
*
* Functions to compile and create the schemas for the `execute` field
* in project and frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readYaml } from "../yaml.ts";
import { objectSchemaFromFieldsFile, convertFromFieldsObject } from "../schema/from-yaml.ts";
import { schemaPath } from "./utils.ts";
import { Schema } from "../lib/schema.ts";
import { allOfSchema, idSchema } from "../schema/common.ts";

export function getFormatExecuteOptionsSchema()
{
  const fields: Record<string, Schema> = {};

  const schemas = [
    "format-execute-global.yml",
    "format-execute-scoped.yml",
    "format-execute-cell.yml"
  ].map((file) => objectSchemaFromFieldsFile(schemaPath(file)));
  
  // FIXME description
  return idSchema(allOfSchema(...schemas), "front-matter-execute");
}

export function getFormatExecuteGlobalOptionsSchema()
{
  return objectSchemaFromFieldsFile(schemaPath("format-execute-global.yml"));
}

export function getFormatExecuteScopedOptionsSchema()
{
  return objectSchemaFromFieldsFile(schemaPath("format-execute-scoped.yml"));
}

export function getFormatExecuteCellOptionsSchema()
{
  return objectSchemaFromFieldsFile(schemaPath("format-execute-cell.yml"));
}
