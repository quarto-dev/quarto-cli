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
import { resourcePath } from "../resources.ts";
import { Schema } from "../lib/schema.ts";
import { allOfSchema, idSchema } from "../schema/common.ts";

export function getFormatExecuteOptionsSchema()
{
  const fields: Record<string, Schema> = {};

  const schemas = [
    "/schema/format-execute-global.yml",
    "/schema/format-execute-scoped.yml",
    "/schema/format-execute-cell.yml"
  ].map((file) => objectSchemaFromFieldsFile(resourcePath(file)));
  
  // FIXME description
  return idSchema(allOfSchema(...schemas), "/quarto/schemas/front-matter-execute");
}

export function getFormatExecuteGlobalOptionsSchema()
{
  return objectSchemaFromFieldsFile(resourcePath("/schema/format-execute-global.yml"));
}

export function getFormatExecuteScopedOptionsSchema()
{
  return objectSchemaFromFieldsFile(resourcePath("/schema/format-execute-scoped.yml"));
}

export function getFormatExecuteCellOptionsSchema()
{
  return objectSchemaFromFieldsFile(resourcePath("/schema/format-execute-cell.yml"));
}
