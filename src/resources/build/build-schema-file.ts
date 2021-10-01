/*
* build-schema-file.ts
*
* Collects the existing schemas and builds a single JSON file with
* their description
* 
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { frontMatterSchema } from "../../core/schema/front-matter.ts";
import { configSchema } from "../../core/schema/config.ts";

const obj = {
  schemas: {
    "front-matter": frontMatterSchema,
    "config": configSchema
  }
};

const str = JSON.stringify(obj, null, 2);

Deno.writeTextFileSync("../editor/tools/yaml/quarto-json-schemas.json", str);
