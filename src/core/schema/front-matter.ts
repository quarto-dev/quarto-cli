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
  idSchema as withId,
  NullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  StringSchema as StringS,
} from "./common.ts";

import { formatExecuteOptionsSchema as execute } from "./types.ts";

export const htmlOptionsSchema = oneOfS(execute, enumS("default"));

export const htmlFormatSchema = objectS({
  properties: {
    "html": htmlOptionsSchema,
  },
  description: "be an HTML format object",
});

export const frontMatterFormatSchema = oneOfS(
  enumS("html", "revealjs", "pdf"),
  htmlFormatSchema,
);

// for empty front matter, we return `null`, so we need to allow that
// as well.
export const frontMatterSchema = withId(
  oneOfS(
    nullS,
    objectS({
      properties: {
        title: StringS,
        // execute,
        // format: frontMatterFormatSchema,
        //
        // NOTE: we are temporarily disabling format validation
        // because it's way too strict
      },
      description: "be a Quarto YAML front matter object",
    }),
  ),
  "front-matter",
);
