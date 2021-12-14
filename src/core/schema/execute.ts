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
import { objectRefSchemaFromGlob, SchemaField } from "../schema/from-yaml.ts";
import { schemaPath } from "./utils.ts";
import { Schema } from "../lib/schema.ts";
import { allOfSchema, idSchema } from "../schema/common.ts";

export function getFormatExecuteOptionsSchema()
{
  return idSchema(objectRefSchemaFromGlob(
    schemaPath("new/{document,cell}-*.yml"),
    ((field: SchemaField, path: string) => (
      path.endsWith("document-execute.yml") ||
        ((field?.tags?.contexts || []) as string[]).some(
          c => c === "document-execute")))
  ), "front-matter-execute");
}
