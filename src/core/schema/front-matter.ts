/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { formatExecuteOptionsSchema as execute } from "./types.ts";
import { StringSchema as String_ } from "./common.ts";

export const frontMatterSchema = {
  "type": "object",
  properties: {
    title: String_,
    execute
  }
};
