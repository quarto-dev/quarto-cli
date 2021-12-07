/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema, normalizeSchema } from "../lib/schema.ts";
import { objectSchemaFromFieldsFile } from "./from-yaml.ts";
import { objectSchema, allOfSchema as allOfS, idSchema } from "./common.ts";
import { schemaPath } from "./utils.ts";

let normalizedCache: Record<string, Schema> | undefined = undefined;
let unNormalizedCache: Record<string, Schema> | undefined = undefined;

export function getEngineOptionsSchema(normalized?: boolean): Record<string, Schema>
{
  if (normalized && normalizedCache !== undefined) {
    return normalizedCache;
  }
  if (!normalized && unNormalizedCache !== undefined) {
    return unNormalizedCache;
  }

  const allOpts = objectSchemaFromFieldsFile(schemaPath("cell-options.yml"));
  const knitrOpts = objectSchemaFromFieldsFile(schemaPath("cell-options-knitr.yml"));
  const jupyterOpts = objectSchemaFromFieldsFile(schemaPath("cell-options-jupyter.yml"));
  
  const execute = objectSchemaFromFieldsFile(schemaPath("format-execute-cell.yml"));
  const render = objectSchemaFromFieldsFile(schemaPath("format-render-cell.yml"));

  const all = idSchema(allOfS(allOpts, execute, render), "engine-markdown");
  const knitr = idSchema(allOfS(allOpts, execute, render, knitrOpts), "engine-knitr");
  const jupyter = idSchema(allOfS(allOpts, execute, render, jupyterOpts), "engine-jupyter");
  
  if (normalized) {
    normalizedCache = {
      "markdown": normalizeSchema(all),
      "knitr": normalizeSchema(knitr),
      "jupyter": normalizeSchema(jupyter),
    };
    return normalizedCache;
  } else {
    unNormalizedCache = {
      "markdown": all,
      knitr,
      jupyter
    };
    return unNormalizedCache;
  };
}
