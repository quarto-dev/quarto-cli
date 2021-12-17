/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { LocalizedError, AnnotatedParse } from "../lib/yaml-schema.ts";
import { Schema, normalizeSchema } from "../lib/schema.ts";
import { addValidatorErrorHandler } from "../lib/validator-queue.ts";
import { objectRefSchemaFromGlob } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
import { schemaPath } from "./utils.ts";
import { tidyverseInfo, tidyverseError } from "../log.ts";

let normalizedCache: Record<string, Schema> | undefined = undefined;
let unNormalizedCache: Record<string, Schema> | undefined = undefined;

function checkForEqualsInChunk(
  error: LocalizedError, parse: AnnotatedParse, _schema: Schema
)
{
  if (typeof error.violatingObject.result !== "string")
    return error;
  const badObject = error.violatingObject.result;
  if (error.error.keyword !== 'type')
    return error;
  let m;
  const errorHeading = `${error.location}: \`${badObject}\` must be a YAML mapping.`;
  const errorMsg = tidyverseError(`\`${badObject}\` is a string.`);
  
  if (m = badObject.match(/= *TRUE/i)) {
    const suggestion = tidyverseInfo(`Did you accidentally use \`${m[0]}\` instead of \`: true\`?`);
    error = {
      ...error,
      message: [errorHeading, errorMsg, suggestion].join("\n")
    };
  } else if (m = badObject.match(/= *FALSE/i)) {
    const suggestion = tidyverseInfo(`Did you accidentally use \`${m[0]}\` instead of \`: false\`?`);
    error = {
      ...error,
      message: [errorHeading, errorMsg, suggestion].join("\n")
    };
  } else if (badObject.match('=')) {
    const suggestion = tidyverseInfo(`Did you accidentally use \`=\` instead of \`:\`?`);
    error = {
      ...error,
      message: [errorHeading, errorMsg, suggestion].join("\n")
    };
  }
  return error;
}

export async function getEngineOptionsSchema(normalized?: boolean): Promise<Record<string, Schema>>
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

  normalizedCache = {
    "markdown": normalizeSchema(markdown),
    "knitr": normalizeSchema(knitr),
    "jupyter": normalizeSchema(jupyter),
  };
  unNormalizedCache = {
    markdown,
    knitr,
    jupyter
  };

  await addValidatorErrorHandler(normalizedCache.knitr, checkForEqualsInChunk);
  if (normalized) {
    return normalizedCache;
  } else {
    return unNormalizedCache;
  };
}
