/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { LocalizedError, AnnotatedParse } from "../lib/yaml-schema.ts";
import { normalizeSchema, Schema } from "../lib/schema.ts";
import { addValidatorErrorHandler } from "../lib/validator-queue.ts";
import { objectRefSchemaFromContextGlob, SchemaField } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
import { schemaPath } from "./utils.ts";
import { tidyverseFormatError, quotedStringColor, TidyverseError, addFileInfo, addInstancePathInfo } from "../lib/errors.ts";
import { defineCached } from "./definitions.ts";

function checkForEqualsInChunk(
  error: LocalizedError, parse: AnnotatedParse, _schema: Schema
)
{
  if (typeof error.violatingObject.result !== "string")
    return error;
  const badObject = error.source.value.substring(
    error.violatingObject.start,
    error.violatingObject.end);

  if (error.ajvError.keyword !== 'type')
    return error;
  let m;
  const heading = `${error.location}: ${quotedStringColor(badObject)} must be a YAML mapping.`;
  const errorMsg = [`${quotedStringColor(badObject)} is a string.`];
  
  const newError: TidyverseError = {
    heading,
    error: errorMsg,
    info: []
  };
  addFileInfo(newError, error.source);
  addInstancePathInfo(newError, error.ajvError.instancePath);
  
  if (m = badObject.match(/= *TRUE/i)) {
    newError.info.push(`Try using ${quotedStringColor(": true")} instead of ${quotedStringColor(m[0])}.`);
  } else if (m = badObject.match(/= *FALSE/i)) {
    newError.info.push(`Try using ${quotedStringColor(": false")} instead of ${quotedStringColor(m[0])}.`);
  } else if (badObject.match('=')) {
    newError.info.push(`Try using ${quotedStringColor(":")} instead of ${quotedStringColor("=")}.`);
  } else {
    // it didn't match any, so don't change the error.
    return error;
  }
  
  return {
    ...error,
    message: tidyverseFormatError(newError)
  };
}

const makeEngineSchema = (engine: string): Schema =>
  idSchema(objectRefSchemaFromContextGlob(
    "cell-*",
    (field: SchemaField, _path: string) => {
      const engineTag = field?.tags?.engine;
      return engineTag === undefined || engineTag === engine;
    }), `engine-${engine}`);

const markdownEngineSchema = defineCached(() => makeEngineSchema("markdown"), "engine-markdown");
const knitrEngineSchema = defineCached(() => makeEngineSchema("markdown"), "engine-knitr");
const jupyterEngineSchema = defineCached(() => makeEngineSchema("markdown"), "engine-jupyter");

export async function getEngineOptionsSchema(): Promise<Record<string, Schema>>
{
  let obj = {
    markdown: await markdownEngineSchema(),
    knitr: await knitrEngineSchema(),
    jupyter: await jupyterEngineSchema(),
  };
  
  // FIXME how does this get to the IDE??
  await addValidatorErrorHandler(obj.knitr, checkForEqualsInChunk);

  return obj;
}
