/*
* execute.ts
*
* Functions to compile and create the schemas for the `execute` field
* in project and frontmatter
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { objectRefSchemaFromContextGlob } from "../yaml-schema/from-yaml.ts";
import { idSchema, refSchema } from "../yaml-schema/common.ts";
import { define } from "./definitions.ts";

export function getFormatExecuteOptionsSchema() {
  const schema = idSchema(
    objectRefSchemaFromContextGlob("document-execute"),
    "front-matter-execute",
  );

  define(schema);
  return refSchema("front-matter-execute", "be a front-matter-execute object");
}
