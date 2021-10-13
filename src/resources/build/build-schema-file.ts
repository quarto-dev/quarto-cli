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
import { languageOptionsValidators } from "../../core/schema/chunk-metadata.ts";

const obj = {
  schemas: {
    "front-matter": frontMatterSchema,
    "config": configSchema,
    "languages": languageOptionsValidators
  }
};

const str = JSON.stringify(obj, null, 2);

Deno.writeTextFileSync("../editor/tools/yaml/quarto-json-schemas.json", str);
