/*
* errors.ts
*
* Functions for creating/setting yaml validation errors
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import * as colors from "../external/colors.ts";

import { getVerbatimInput, navigate, YAMLSchema } from "./yaml-schema.ts";

import { lines } from "../text.ts";

import {
  addFileInfo,
  addInstancePathInfo,
  locationString,
  quotedStringColor,
  TidyverseError,
} from "../errors.ts";

import { mappedIndexToRowCol } from "../mapped-text.ts";

import { possibleSchemaKeys, possibleSchemaValues } from "./schema-utils.ts";

import { editDistance } from "../text.ts";

import {
  AnnotatedParse,
  JSONValue,
  LocalizedError,
  ObjectSchema,
  Schema,
  schemaCall,
  schemaDescription,
  schemaType,
} from "../yaml-schema/types.ts";

////////////////////////////////////////////////////////////////////////////////

export type ValidatorErrorHandlerFunction = (
  error: LocalizedError,
  parse: AnnotatedParse,
  /* this is the _outer_ schema, which failed the validation of
   * parse.result. error also holds error.schema, which is a subschema
   * of the outer schema which failed the validation of
   * error.violatingObject (a subobject of parse.result).
   */
  schema: Schema,
) => LocalizedError;

export function setDefaultErrorHandlers(validator: YAMLSchema) {
  validator.addHandler(expandEmptySpan);
  validator.addHandler(improveErrorHeadingForValueErrors);
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);
  validator.addHandler(identifyKeyErrors);
  validator.addHandler(checkForNearbyCorrection);
  validator.addHandler(checkForNearbyRequired);
  validator.addHandler(schemaDefinedErrors);
}

export function errorKeyword(
  error: LocalizedError,
): string {
  if (error.schemaPath.length === 0) {
    return "";
  }
  return String(error.schemaPath[error.schemaPath.length - 1]);
}

export function getBadKey(error: LocalizedError): string | undefined {
  if (error.schemaPath.indexOf("propertyNames") === -1) {
    return undefined;
  }
  const result = error.violatingObject.result;
  if (typeof result !== "string") {
    throw new Error(
      "Internal Error: propertyNames error has a violating non-string.",
    );
  }
  return result;
}

function isEmptyValue(error: LocalizedError) {
  const rawVerbatimInput = getVerbatimInput(error);
  return rawVerbatimInput.trim().length === 0;
}

function getLastFragment(
  instancePath: (string | number)[],
): undefined | number | string {
  if (instancePath.length === 0) {
    return undefined;
  }
  return instancePath[instancePath.length - 1];
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

function formatHeadingForKeyError(
  _error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
  key: string,
): string {
  return `property name ${colors.blue(key)} is invalid`;
}

function formatHeadingForValueError(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
): string {
  const rawVerbatimInput = reindent(getVerbatimInput(error));
  const rawLines = lines(rawVerbatimInput);
  let verbatimInput: string;
  if (rawLines.length > 4) {
    verbatimInput = quotedStringColor(
      [...rawLines.slice(0, 2), "...", ...rawLines.slice(-2)]
        .join("\n"),
    );
  } else {
    verbatimInput = quotedStringColor(rawVerbatimInput);
  }

  const empty = isEmptyValue(error);
  const lastFragment = getLastFragment(error.instancePath);

  switch (typeof lastFragment) {
    case "undefined": // empty
      if (empty) {
        return "YAML value is missing.";
      } else {
        return `YAML value ${verbatimInput} must ${
          schemaDescription(error.schema)
        }.`;
      }
    case "number": // array
      if (empty) {
        return `Array entry ${lastFragment + 1} is empty but it must instead ${
          schemaDescription(error.schema)
        }.`;
      } else {
        return `Array entry ${
          lastFragment + 1
        } with value ${verbatimInput} failed to ${
          schemaDescription(error.schema)
        }.`;
      }
    case "string": { // object
      const formatLastFragment = colors.blue(lastFragment);
      if (empty) {
        return `Key ${formatLastFragment} has empty value but it must instead ${
          schemaDescription(error.schema)
        }`;
      } else {
        return `Key ${formatLastFragment} has value ${verbatimInput}, which must ${
          schemaDescription(error.schema)
        }`;
      }
    }
  }
}

function identifyKeyErrors(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): LocalizedError {
  if (error.schemaPath.indexOf("propertyNames") === -1) {
    return error;
  }

  const badKey = getBadKey(error);
  if (badKey) {
    if (
      error.instancePath.length &&
      error.instancePath[error.instancePath.length - 1] !== badKey
    ) {
      addInstancePathInfo(
        error.niceError,
        [...error.instancePath, badKey],
      );
    } else {
      addInstancePathInfo(
        error.niceError,
        error.instancePath,
      );
    }

    error.niceError.heading = formatHeadingForKeyError(
      error,
      parse,
      schema,
      badKey,
    );
  }

  return error;
}

function improveErrorHeadingForValueErrors(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): LocalizedError {
  // TODO this check is supposed to be "don't mess with errors where
  // the violating object is in key position". I think my condition
  // catches everything but I'm not positive.
  //
  // 2022-02-08: yup, I was wrong, there's also missing properties errors
  // which are not addressed here.

  if (
    error.schemaPath.indexOf("propertyNames") !== -1 ||
    errorKeyword(error) === "required"
  ) {
    return error;
  }
  return {
    ...error,
    niceError: {
      ...error.niceError,
      heading: formatHeadingForValueError(error, parse, schema),
    },
  };
}

// in cases where the span of an error message is empty (which happens
// when eg an empty value is associated with a key), we artificially
// move the span to the _key_ so that the error is printed somewhat
// more legibly.
function expandEmptySpan(
  error: LocalizedError,
  parse: AnnotatedParse,
  _schema: Schema,
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
    error.instancePath,
    parse,
    true,
  )!;
  const locF = mappedIndexToRowCol(parse.source);
  try {
    const location = {
      start: locF(lastKey.start - 1),
      end: locF(lastKey.end - 1),
    };

    return {
      ...error,
      location,
      niceError: {
        ...error.niceError,
        location,
      },
    };
  } catch (_e) {
    return error;
  }
}

function checkForTypeMismatch(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) {
  const rawVerbatimInput = getVerbatimInput(error);
  const rawLines = lines(rawVerbatimInput);
  let verbatimInput: string;
  if (rawLines.length > 4) {
    verbatimInput = quotedStringColor(
      [...rawLines.slice(0, 2), "...", ...rawLines.slice(-2)]
        .join("\n"),
    );
  } else {
    verbatimInput = quotedStringColor(rawVerbatimInput);
  }
  const goodType = (obj: JSONValue) => {
    if (Array.isArray(obj)) {
      return "an array";
    }
    if (obj === null) {
      return "a null value";
    }
    return typeof obj;
  };

  if (errorKeyword(error) === "type" && rawVerbatimInput.length > 0) {
    const newError: TidyverseError = {
      ...error.niceError,
      heading: formatHeadingForValueError(
        error,
        parse,
        schema,
      ),
      error: [
        `The value ${verbatimInput} is ${
          goodType(
            error.violatingObject
              .result,
          )
        }.`,
      ],
      info: {},
      location: error.niceError.location,
    };
    addInstancePathInfo(newError, error.instancePath);
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
  _schema: Schema,
) {
  const schema = error.schema;
  if (
    !(typeof error.violatingObject.result === "string" &&
      errorKeyword(error) === "type" &&
      (schemaType(schema) === "boolean"))
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
    heading: formatHeadingForValueError(error, parse, schema),
    error: [errorMessage],
    info: {},
    location: error.niceError.location,
  };
  addInstancePathInfo(newError, error.instancePath);
  addFileInfo(newError, error.source);
  newError.info["yaml-version-1.2"] = suggestion1;
  newError.info["suggestion-fix"] = suggestion2;

  return {
    ...error,
    niceError: newError,
  };
}

// a custom errorMessage is either a string
// or a Record<string, string> that dispatches on type of error
//
type CustomErrorMessage = string | Record<string, string>;

function createErrorFragments(error: LocalizedError) {
  const rawVerbatimInput = getVerbatimInput(error);
  const verbatimInput = quotedStringColor(reindent(rawVerbatimInput));

  const pathFragments = error.instancePath.map((s) => colors.blue(String(s)));

  return {
    location: locationString(error.location),
    fullPath: pathFragments.join(":"),
    key: pathFragments[pathFragments.length - 1],
    value: verbatimInput,
  };
}

// FIXME we should navigate the schema path
// to find the schema-defined error in case it's not
// error.schema
function schemaDefinedErrors(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
): LocalizedError {
  const schema = error.schema;
  if (schema === true || schema === false) {
    return error;
  }
  if (schema.errorMessage === undefined) {
    return error;
  }
  if (typeof schema.errorMessage !== "string") {
    return error;
  }

  let result = schema.errorMessage;
  for (const [k, v] of Object.entries(createErrorFragments(error))) {
    result = result.replace("${" + k + "}", v);
  }

  return {
    ...error,
    niceError: {
      ...error.niceError,
      heading: result,
    },
  };
}

function checkForNearbyRequired(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
): LocalizedError {
  const schema = error.schema;

  if (errorKeyword(error) !== "required") {
    return error;
  }
  const missingKeys: string[] = [];
  const errObj = error.violatingObject.result as Record<string, unknown>;
  const keys = Object.keys(errObj);

  schemaCall(schema, {
    object(s: ObjectSchema) {
      if (s.required === undefined) {
        throw new Error(
          "Internal Error: required schema error without a required field",
        );
      }
      // find required properties.
      for (const r of s.required) {
        if (keys.indexOf(r) === -1) {
          missingKeys.push(r);
        }
      }
    },
  }, (_) => {
    throw new Error("Internal Error: required error on a non-object schema");
  });

  for (const missingKey of missingKeys) {
    let bestCorrection: string[] | undefined;
    let bestDistance = Infinity;
    for (const correction of keys) {
      const d = editDistance(correction, missingKey);
      if (d < bestDistance) {
        bestCorrection = [correction];
        bestDistance = d;
      } else if (d === bestDistance) {
        bestCorrection!.push(correction);
        bestDistance = d;
      }
    }

    // TODO we need a defensible way of determining a cutoff here.
    // One idea is to turn this into a hypothesis test, checking random
    // english words against a dictionary and looking at the distribution
    // of edit distances. Presently, we hack.

    // if best edit distance is more than 30% of the word, don't suggest
    if (bestDistance > missingKey.length * 10 * 0.3) {
      continue;
    }

    const suggestions = bestCorrection!.map((s: string) => colors.blue(s));
    if (suggestions.length === 1) {
      error.niceError.info[`did-you-mean-key`] = `Is ${
        suggestions[0]
      } a typo of ${colors.blue(missingKey)}?`;
    } else if (suggestions.length === 2) {
      error.niceError.info[`did-you-mean-key`] = `Is ${suggestions[0]} or ${
        suggestions[1]
      } a typo of ${colors.blue(missingKey)}?`;
    } else {
      suggestions[suggestions.length - 1] = `or ${
        suggestions[suggestions.length - 1]
      }`;
      error.niceError.info[`did-you-mean-key`] = `Is one of ${
        suggestions.join(", ")
      } a typo of ${colors.blue(missingKey)}?`;
    }
  }

  return error;
}

function checkForNearbyCorrection(
  error: LocalizedError,
  parse: AnnotatedParse,
  _schema: Schema,
): LocalizedError {
  const schema = error.schema;
  const corrections: string[] = [];

  let errVal = "";
  let keyOrValue = "";
  const key = getBadKey(error);

  if (key) {
    errVal = key;
    corrections.push(...possibleSchemaKeys(schema));
    keyOrValue = "key";
  } else {
    const val = navigate(error.instancePath, parse);

    if (typeof val!.result !== "string") {
      // error didn't happen in a string, can't suggest corrections.
      return error;
    }
    errVal = val!.result;
    corrections.push(...possibleSchemaValues(schema));
    keyOrValue = "value";
  }
  if (corrections.length === 0) {
    return error;
  }

  let bestCorrection: string[] | undefined;
  let bestDistance = Infinity;
  for (const correction of corrections) {
    const d = editDistance(correction, errVal);
    if (d < bestDistance) {
      bestCorrection = [correction];
      bestDistance = d;
    } else if (d === bestDistance) {
      bestCorrection!.push(correction);
      bestDistance = d;
    }
  }

  // TODO we need a defensible way of determining a cutoff here.
  // One idea is to turn this into a hypothesis test, checking random
  // english words against a dictionary and looking at the distribution
  // of edit distances. Presently, we hack.

  // if best edit distance is more than 30% of the word, don't suggest
  if (bestDistance > errVal.length * 10 * 0.3) {
    return error;
  }

  const suggestions = bestCorrection!.map((s: string) => colors.blue(s));
  if (suggestions.length === 1) {
    error.niceError.info[`did-you-mean-${keyOrValue}`] = `Did you mean ${
      suggestions[0]
    }?`;
  } else if (suggestions.length === 2) {
    error.niceError.info[`did-you-mean-${keyOrValue}`] = `Did you mean ${
      suggestions[0]
    } or ${suggestions[1]}?`;
  } else {
    suggestions[suggestions.length - 1] = `or ${
      suggestions[suggestions.length - 1]
    }`;
    error.niceError.info[`did-you-mean-${keyOrValue}`] = `Did you mean ${
      suggestions.join(", ")
    }?`;
  }

  return error;
}
