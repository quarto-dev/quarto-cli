/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Schema, normalizeSchema } from "../lib/schema.ts";
import { objectRefSchemaFromGlob } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
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

  const markdown = idSchema(objectRefSchemaFromGlob(
    schemaPath("new/cell-*.yml"),
    (field, _path) => {
      const engine = field?.tags?.engine
      return engine === undefined || engine === "markdown";
    }), "engine-markdown");
  const knitr = idSchema(objectRefSchemaFromGlob(
    schemaPath("new/cell-*.yml"),
    (field, _path) => {
      const engine = field?.tags?.engine;
      return engine === undefined || engine === "knitr"
    }), "engine-knitr");
  const jupyter = idSchema(objectRefSchemaFromGlob(
    schemaPath("new/cell-*.yml"),
    (field, _path) => {
      const engine = field?.tags?.engine;
      return engine === undefined || engine === "jupyter"
    }), "engine-jupyter");
  
 
  if (normalized) {
    normalizedCache = {
      "markdown": normalizeSchema(markdown),
      "knitr": normalizeSchema(knitr),
      "jupyter": normalizeSchema(jupyter),
    };
    return normalizedCache;
  } else {
    unNormalizedCache = {
      markdown,
      knitr,
      jupyter
    };
    return unNormalizedCache;
  };
}
