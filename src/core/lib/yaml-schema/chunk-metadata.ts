/*
 * chunk-metadata.ts
 *
 * JSON Schema for Quarto's YAML chunk metadata
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { objectRefSchemaFromContextGlob, SchemaField } from "./from-yaml.ts";
import { idSchema } from "./common.ts";
import {
  addFileInfo,
  addInstancePathInfo,
  quotedStringColor,
  tidyverseFormatError,
} from "../errors.ts";
import { TidyverseError } from "../errors-types.ts";
import { defineCached } from "./definitions.ts";

import {
  AnnotatedParse,
  ConcreteSchema,
  LocalizedError,
  Schema,
} from "../yaml-schema/types.ts";

import { errorKeyword } from "../yaml-validation/errors.ts";
import { InternalError } from "../error.ts";

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

  if (errorKeyword(error) !== "type") {
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
    info: {},
  };
  addFileInfo(newError, error.source);
  addInstancePathInfo(newError, error.instancePath);

  // deno-lint-ignore no-cond-assign
  if (m = badObject.match(/= *TRUE/i)) {
    newError.info["suggestion-fix"] = `Try using ${
      quotedStringColor(": true")
    } instead of ${quotedStringColor(m[0])}.`;
    // deno-lint-ignore no-cond-assign
  } else if (m = badObject.match(/= *FALSE/i)) {
    newError.info["suggestion-fix"] = `Try using ${
      quotedStringColor(": false")
    } instead of ${quotedStringColor(m[0])}.`;
  } else if (badObject.match("=")) {
    newError.info["suggestion-fix"] = `Try using ${
      quotedStringColor(":")
    } instead of ${quotedStringColor("=")}.`;
  } else {
    // it didn't match any, so don't change the error.
    return error;
  }

  return {
    ...error,
    message: tidyverseFormatError(newError),
  };
}

const makeEngineSchema = (engine: string): ConcreteSchema =>
  idSchema(
    objectRefSchemaFromContextGlob(
      "cell-*",
      (field: SchemaField, _path: string) => {
        const engineTag = field && field.tags && field.tags.engine;
        switch (typeof engineTag) {
          case "undefined":
            return true;
          case "string":
            return engineTag === engine;
          case "object":
            return (engineTag as string[]).indexOf(engine) !== -1;
          default:
            throw new InternalError(`bad engine tag ${engineTag}`);
        }
      },
    ),
    `engine-${engine}`,
  );

const markdownEngineSchema = defineCached(
  // deno-lint-ignore require-await
  async () => {
    return {
      schema: makeEngineSchema("markdown"),
      errorHandlers: [],
    };
  },
  "engine-markdown",
);
const knitrEngineSchema = defineCached(
  async () => {
    const result = await makeEngineSchema("knitr");

    // FIXME how does this get to the IDE?
    return { schema: result, errorHandlers: [checkForEqualsInChunk] };
  },
  "engine-knitr",
);
const jupyterEngineSchema = defineCached(
  // deno-lint-ignore require-await
  async () => {
    return {
      schema: makeEngineSchema("jupyter"),
      errorHandlers: [],
    };
  },
  "engine-jupyter",
);

export async function getEngineOptionsSchema(): Promise<
  Record<string, ConcreteSchema>
> {
  const obj = {
    markdown: await markdownEngineSchema(),
    knitr: await knitrEngineSchema(),
    jupyter: await jupyterEngineSchema(),
  };

  return obj;
}
