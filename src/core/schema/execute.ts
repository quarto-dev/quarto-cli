/*
* execute.ts
*
* Functions to compile and create the schemas for the `execute` field
* in project and frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { objectRefSchemaFromContextGlob } from "../schema/from-yaml.ts";
import { idSchema, refSchema } from "../schema/common.ts";
import { define } from "./definitions.ts";

export async function getFormatExecuteOptionsSchema() {
  const schema = idSchema(
    objectRefSchemaFromContextGlob("document-execute"),
    "front-matter-execute",
  );

  await define(schema);
  return refSchema("front-matter-execute", "be a front-matter-execute object");
}
