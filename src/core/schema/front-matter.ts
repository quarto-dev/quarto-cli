/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  enumSchema as enumS,
  NullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  StringSchema as StringS,
} from "./common.ts";

import { YAMLSchema } from "./yaml-schema.ts";

import { formatExecuteOptionsSchema as execute } from "./types.ts";

export const htmlOptionsSchema = execute;

export const htmlFormatSchema = objectS({
  properties: {
    "html": htmlOptionsSchema,
  },
  description: "be an HTML format object",
});

export const frontMatterFormatSchema = oneOfS(
  enumS("html", "pdf"),
  htmlFormatSchema,
);

// for empty front matter, we return `null`, so we need to allow that
// as well.
export const frontMatterSchema = oneOfS(
  nullS,
  objectS({
    properties: {
      title: StringS,
      execute,
      format: frontMatterFormatSchema,
    },
    description: "be a Quarto YAML front matter object",
  }),
);

export const frontMatterValidator = new YAMLSchema(frontMatterSchema);
