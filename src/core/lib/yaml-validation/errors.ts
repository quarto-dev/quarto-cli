/*
* errors.ts
*
* Functions for creating/setting yaml validation errors
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import * as colors from "../external/colors.ts";

import {
  AnnotatedParse,
  getVerbatimInput,
  LocalizedError,
  YAMLSchema,
} from "./yaml-schema.ts";

import { Schema } from "./schema.ts";

import {
  addFileInfo,
  addInstancePathInfo,
  quotedStringColor,
  TidyverseError,
} from "../errors.ts";

import { lines } from "../text.ts";

import { navigate, navigateSchema } from "./yaml-schema.ts";

import { mappedIndexToRowCol } from "../mapped-text.ts";

export type ValidatorErrorHandlerFunction = (
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) => LocalizedError;

function isEmptyValue(error: LocalizedError) {
  const rawVerbatimInput = getVerbatimInput(error);
  return rawVerbatimInput.trim().length === 0;
}

function getLastFragment(instancePath: string): undefined | number | string {
  const splitPath = instancePath.split("/");
  if (splitPath.length === 0) {
    return undefined;
  }
  const lastFragment = splitPath[splitPath.length - 1];
  if (lastFragment === "") {
    return undefined;
  }
  const maybeNumber = Number(lastFragment);
  if (!isNaN(maybeNumber)) {
    return maybeNumber;
  }
  return lastFragment;
}

/* reindent: produce a minimally-indented version
of the yaml string given.

Woooo boy, this is messy.

Consider the following example in a chunk.

```{r}
#| foo:
#|   bar: 1
#|   bah:
#|     baz: 3
```
Let's say we want to reindent the object starting at "bah:".

we'd like the "reindent" to be

bah:
  baz: 3

but the string we have is 'bah:\n baz: 3', so we don't actually know
how much to cut. We need the column where the object
starts. _however_, in our mappedstrings infra, that is the column _in
the target space_, not the _original column_ information (which is
what we have). So we're going to have to track _both_ pieces of
information.

*/

function reindent(
  str: string,
) {
  // TO BE FINISHED WHILE WE HANDLE THE ABOVE COMMENT
  return str;
}

function innerDescription(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): string {
  const schemaPath = error.ajvError.schemaPath.split("/").slice(1);
  const errorSchema = (error.ajvError.params && error.ajvError.params.schema) ||
    error.ajvError.parentSchema;
  const innerSchema = errorSchema
    ? [errorSchema]
    : navigateSchema(schemaPath.map(decodeURIComponent), schema);
  return innerSchema.map((s: Schema) => s.description).join(", ");
}

function formatHeading(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): string {
  const rawVerbatimInput = getVerbatimInput(error);
  const verbatimInput = quotedStringColor(reindent(rawVerbatimInput));

  const empty = isEmptyValue(error);
  const lastFragment = getLastFragment(error.instancePath);

  switch (typeof lastFragment) {
    case "undefined": // empty
      if (empty) {
        return "YAML object is missing.";
      } else {
        const innerDesc = innerDescription(error, parse, schema);
        return `YAML object ${verbatimInput} must instead ${innerDesc}`;
      }
    case "number": // array
      const innerDesc = innerDescription(error, parse, schema);
      if (empty) {
        return `Array entry ${
          lastFragment + 1
        } is empty but it must instead ${innerDesc}.`;
      } else {
        return `Array entry ${
          lastFragment + 1
        } has value ${verbatimInput} must instead ${innerDesc}.`;
      }
    case "string": { // object
      const formatLastFragment = colors.blue(lastFragment);
      const innerDesc = innerDescription(error, parse, schema);
      if (empty) {
        return `Key ${formatLastFragment} has empty value but it must instead ${innerDesc}`;
      } else {
        return `Key ${formatLastFragment} has value ${verbatimInput} but it must instead ${innerDesc}`;
      }
    }
  }
}

function improveErrorHeading(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): LocalizedError {
  return {
    ...error,
    niceError: {
      ...error.niceError,
      heading: formatHeading(error, parse, schema),
    },
  };
}

// in cases where the span of an error message is empty, we artificially
// expand the span so that the error is printed somewhat more legibly.
function expandEmptySpan(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): LocalizedError {
  if (
    error.location.start.line !== error.location.end.line ||
    error.location.start.column !== error.location.end.column ||
    !isEmptyValue(error) ||
    (typeof getLastFragment(error.instancePath) === "undefined")
  ) {
    return error;
  }

  const lastKey = navigate(
    error.instancePath.split("/").slice(1),
    parse,
    true,
  )!;
  const locF = mappedIndexToRowCol(error.source);
  const location = {
    start: locF(lastKey.start),
    end: locF(lastKey.end),
  };

  return {
    ...error,
    location,
    niceError: {
      ...error.niceError,
      location,
    },
  };
}

export function setDefaultErrorHandlers(validator: YAMLSchema) {
  validator.addHandler(expandEmptySpan);
  validator.addHandler(improveErrorHeading);
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);
}

function checkForTypeMismatch(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) {
  const rawVerbatimInput = getVerbatimInput(error);
  const verbatimInput = quotedStringColor(rawVerbatimInput);

  if (error.ajvError.keyword === "type" && rawVerbatimInput.length > 0) {
    const newError: TidyverseError = {
      heading: formatHeading(error, parse, schema),
      error: [
        `The value ${verbatimInput} is a ${typeof error.violatingObject
          .result}.`,
      ],
      info: [],
      location: error.niceError.location,
    };
    addInstancePathInfo(newError, error.ajvError.instancePath);
    addFileInfo(newError, error.source);
    return {
      ...error,
      niceError: newError,
    };
  }
  return error;
}

function checkForBadBoolean(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) {
  schema = error.ajvError.params.schema;
  if (
    !(typeof error.violatingObject.result === "string" &&
      error.ajvError.keyword === "type" &&
      (schema && schema.type === "boolean"))
  ) {
    return error;
  }
  const strValue = error.violatingObject.result;
  const verbatimInput = quotedStringColor(getVerbatimInput(error));

  // from https://yaml.org/type/bool.html
  const yesses = new Set("y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON".split("|"));
  const nos = new Set("n|N|no|No|NO|false|False|FALSE|off|Off|OFF".split("|"));
  let fix;
  if (yesses.has(strValue)) {
    fix = true;
  } else if (nos.has(strValue)) {
    fix = false;
  } else {
    return error;
  }

  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 =
    `Quarto uses YAML 1.2, which interprets booleans strictly.`;
  const suggestion2 = `Try using ${quotedStringColor(String(fix))} instead.`;
  const newError: TidyverseError = {
    heading: formatHeading(error, parse, schema),
    error: [errorMessage],
    info: [],
    location: error.niceError.location,
  };
  addInstancePathInfo(newError, error.ajvError.instancePath);
  addFileInfo(newError, error.source);
  newError.info.push(suggestion1, suggestion2);
  return {
    ...error,
    niceError: newError,
  };
}
