/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { AnnotatedParse, LocalizedError } from "../lib/yaml-validation/yaml-schema.ts";
import { Schema } from "../lib/yaml-validation/schema.ts";
import { addValidatorErrorHandler } from "../lib/yaml-validation/validator-queue.ts";
import { objectRefSchemaFromContextGlob, SchemaField } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
import {
  addFileInfo,
  addInstancePathInfo,
  quotedStringColor,
  TidyverseError,
  tidyverseFormatError,
} from "../lib/errors.ts";
import { defineCached } from "./definitions.ts";

function checkForEqualsInChunk(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
) {
  if (typeof error.violatingObject.result !== "string") {
    return error;
  }
  const badObject = error.source.value.substring(
    error.violatingObject.start,
    error.violatingObject.end,
  );

  if (error.ajvError.keyword !== "type") {
    return error;
  }
  let m;
  const heading = `${error.location}: ${
    quotedStringColor(badObject)
  } must be a YAML mapping.`;
  const errorMsg = [`${quotedStringColor(badObject)} is a string.`];

  const newError: TidyverseError = {
    heading,
    error: errorMsg,
    info: [],
  };
  addFileInfo(newError, error.source);
  addInstancePathInfo(newError, error.ajvError.instancePath);

  // deno-lint-ignore no-cond-assign
  if (m = badObject.match(/= *TRUE/i)) {
    newError.info.push(
      `Try using ${quotedStringColor(": true")} instead of ${
        quotedStringColor(m[0])
      }.`,
    );
    // deno-lint-ignore no-cond-assign
  } else if (m = badObject.match(/= *FALSE/i)) {
    newError.info.push(
      `Try using ${quotedStringColor(": false")} instead of ${
        quotedStringColor(m[0])
      }.`,
    );
  } else if (badObject.match("=")) {
    newError.info.push(
      `Try using ${quotedStringColor(":")} instead of ${
        quotedStringColor("=")
      }.`,
    );
  } else {
    // it didn't match any, so don't change the error.
    return error;
  }

  return {
    ...error,
    message: tidyverseFormatError(newError),
  };
}

const makeEngineSchema = (engine: string): Schema =>
  idSchema(
    objectRefSchemaFromContextGlob(
      "cell-*",
      (field: SchemaField, _path: string) => {
        const engineTag = field?.tags?.engine;
        switch (typeof engineTag) {
          case "undefined": return true;
          case "string": return engineTag === engine;
          case "object": return (engineTag as string[]).indexOf(engine) !== -1
          default:
            throw new Error(`Internal Error: bad engine tag ${engineTag}`);
        }
      },
    ),
    `engine-${engine}`,
  );

const markdownEngineSchema = defineCached(
  () => makeEngineSchema("markdown"),
  "engine-markdown",
);
const knitrEngineSchema = defineCached(
  async () => {
    const result = await makeEngineSchema("knitr");
    // FIXME how does this get to the IDE?
    await addValidatorErrorHandler(result, checkForEqualsInChunk);
    return result;
  },
  "engine-knitr",
);
const jupyterEngineSchema = defineCached(
  () => makeEngineSchema("jupyter"),
  "engine-jupyter",
);

export async function getEngineOptionsSchema(): Promise<
  Record<string, Schema>
> {
  const obj = {
    markdown: await markdownEngineSchema(),
    knitr: await knitrEngineSchema(),
    jupyter: await jupyterEngineSchema(),
  };

  return obj;
}
