/*
 * errors.ts
 *
 * Functions for creating/setting yaml validation errors
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import * as colors from "../external/colors.ts";

import { YAMLSchemaT } from "./types.ts";

import {
  addFileInfo,
  addInstancePathInfo,
  locationString,
  quotedStringColor,
} from "../errors.ts";

import { TidyverseError } from "../errors-types.ts";

import {
  mappedIndexToLineCol,
  MappedString,
  mappedString,
  Range,
} from "../mapped-text.ts";

import { possibleSchemaKeys, possibleSchemaValues } from "./schema-utils.ts";

import { editDistance } from "../text.ts";

import {
  AnnotatedParse,
  InstancePath,
  JSONValue,
  LocalizedError,
  ObjectSchema,
  Schema,
  schemaCall,
  schemaDescription,
  SchemaPath,
  schemaType,
} from "../yaml-schema/types.ts";

import { formatLineRange, lines } from "../text.ts";
import { InternalError } from "../error.ts";

////////////////////////////////////////////////////////////////////////////////

export function setDefaultErrorHandlers(validator: YAMLSchemaT) {
  validator.addHandler(ignoreExprViolations);
  validator.addHandler(expandEmptySpan);
  validator.addHandler(improveErrorHeadingForValueErrors);
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);
  validator.addHandler(checkForBadColon);
  validator.addHandler(checkForBadEquals);
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

export function schemaPathMatches(
  error: LocalizedError,
  strs: string[],
): boolean {
  const schemaPath = error.schemaPath.slice(-strs.length);
  if (schemaPath.length !== strs.length) {
    return false;
  }
  return strs.every((str, i) => str === schemaPath[i]);
}

export function getBadKey(error: LocalizedError): string | undefined {
  if (
    error.schemaPath.indexOf("propertyNames") === -1 &&
    error.schemaPath.indexOf("closed") === -1
  ) {
    return undefined;
  }
  const result = error.violatingObject.result;
  if (typeof result !== "string") {
    throw new InternalError(
      "propertyNames error has a violating non-string.",
    );
  }
  return result;
}

function getVerbatimInput(error: LocalizedError) {
  return error.source.value;
}

// this supports AnnotatedParse results built
// from deno yaml as well as tree-sitter.
function navigate(
  path: (number | string)[],
  annotation: AnnotatedParse | undefined,
  returnKey = false, // if true, then return the *key* entry as the final result rather than the *value* entry.
  pathIndex = 0,
): AnnotatedParse | undefined {
  // this looks a little strange, but it's easier to catch the error
  // here than in the different cases below
  if (annotation === undefined) {
    throw new Error("Can't navigate an undefined annotation");
  }
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "mapping" || annotation.kind === "block_mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    // this loop is inverted to provide better error messages in the
    // case of repeated keys. Repeated keys are an error in any case, but
    // the parsing by the validation infrastructure reports the last
    // entry of a given key in the mapping as the one that counts
    // (instead of the first, which would be what we'd get if running
    // the loop forward).
    //
    // In that case, the validation errors will also point to the last
    // entry. In order for the errors to be at least consistent,
    // we then loop backwards
    const lastKeyIndex = ~~((components.length - 1) / 2) * 2;
    for (let i = lastKeyIndex; i >= 0; i -= 2) {
      const key = components[i]!.result;
      if (key === searchKey) {
        if (returnKey && pathIndex === path.length - 1) {
          return navigate(path, components[i], returnKey, pathIndex + 1);
        } else {
          return navigate(path, components[i + 1], returnKey, pathIndex + 1);
        }
      }
    }
    return annotation;
  } else if (
    ["sequence", "block_sequence", "flow_sequence"].indexOf(annotation.kind) !==
      -1
  ) {
    const searchKey = Number(path[pathIndex]);
    if (
      isNaN(searchKey) || searchKey < 0 ||
      searchKey >= annotation.components.length
    ) {
      return annotation;
    }
    return navigate(
      path,
      annotation.components[searchKey],
      returnKey,
      pathIndex + 1,
    );
  } else {
    return annotation;
  }
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

This is messy. Consider the following example in a chunk.

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

but the string we have is 'bah:\n    baz: 3', so we don't actually know
how much to cut. We need the column where the object
starts. _however_, in our mappedstrings infra, that is the column _in
the target space_, not the _original column_ information (which is
what we have).

So we're going to use a heuristic. We first will figure out
all indentation amounts in the string. In the case above
we have Set(4). In an more-deeply nested object such as

#| foo:
#|   bar: 1
#|   bah:
#|     baz:
#|       bam: 3

the string would be 'bah:\n    baz:\n      bam: 3', so the set of
indentation amounts is Set(4, 6). The heuristic is that if
we find two or more amounts, then the difference between the smallest
two values is the desired amount. Otherwise, we indent by 2 characters.
*/

export function reindent(
  str: string,
) {
  const s: Set<number> = new Set();
  const ls = lines(str);
  for (const l of ls) {
    const r = l.match("^[ ]+");
    if (r) {
      s.add(r[0].length);
    }
  }
  if (s.size === 0) {
    return str;
  } else if (s.size === 1) {
    const v = Array.from(s)[0];
    const oldIndent = " ".repeat(v);
    if (v <= 2) {
      return str;
    }
    return ls.map((l) => l.startsWith(oldIndent) ? l.slice(v - 2) : l).join(
      "\n",
    );
  } else {
    const [first, second] = Array.from(s);
    const oldIndent = " ".repeat(first);
    const newIndent = second - first;
    if (newIndent >= first) {
      return str;
    }
    return ls.map((l) =>
      l.startsWith(oldIndent) ? l.slice(first - newIndent) : l
    ).join("\n");
  }
}

function ignoreExprViolations(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
): LocalizedError | null {
  const { result } = error.violatingObject;
  if (
    typeof result !== "object" ||
    Array.isArray(result) ||
    result === null ||
    error.schemaPath.slice(-1)[0] !== "type"
  ) {
    return error;
  }

  if (result.tag === "!expr" && typeof result.value === "string") {
    // assume that this validation error came from !expr, drop the error.
    return null;
  } else {
    return error;
  }
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
      const formatLastFragment = '"' + colors.blue(lastFragment) + '"';
      if (empty) {
        return `Field ${formatLastFragment} has empty value but it must instead ${
          schemaDescription(error.schema)
        }`;
      } else {
        if (verbatimInput.indexOf("\n") !== -1) {
          return `Field ${formatLastFragment} has value

${verbatimInput}

The value must instead ${schemaDescription(error.schema)}.`;
        } else {
          return `Field ${formatLastFragment} has value ${verbatimInput}, which must instead ${
            schemaDescription(error.schema)
          }`;
        }
      }
    }
  }
}

function identifyKeyErrors(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
): LocalizedError {
  if (
    error.schemaPath.indexOf("propertyNames") === -1 &&
    error.schemaPath.indexOf("closed") === -1
  ) {
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
    error.schemaPath.indexOf("closed") !== -1 ||
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
  const locF = mappedIndexToLineCol(parse.source);
  try {
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
    const reindented = reindent(verbatimInput);
    const subject = (reindented.indexOf("\n") === -1)
      ? `The value ${reindented} `
      : `The value

${reindented}

`;
    const newError: TidyverseError = {
      ...error.niceError,
      heading: formatHeadingForValueError(
        error,
        parse,
        schema,
      ),
      error: [
        `${subject}is of type ${
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

// provides better error message when
// "echo:false"
function checkForBadColon(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) {
  if (typeof error.violatingObject.result !== "string") {
    return error;
  }

  if (!schemaPathMatches(error, ["object", "type"])) {
    return error;
  }

  if (
    !((error.violatingObject.result as string).match(/^.+:[^ ].*$/))
  ) {
    return error;
  }

  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 =
    `In YAML, key-value pairs in objects must be separated by a space.`;
  const suggestion2 = `Did you mean ${
    quotedStringColor(
      quotedStringColor(getVerbatimInput(error)).replace(/:/g, ": "),
    )
  } instead?`;
  const newError: TidyverseError = {
    heading: formatHeadingForValueError(error, parse, schema),
    error: [errorMessage],
    info: {},
    location: error.niceError.location,
  };
  addInstancePathInfo(newError, error.instancePath);
  addFileInfo(newError, error.source);
  newError.info["yaml-key-value-pairs"] = suggestion1;
  newError.info["suggestion-fix"] = suggestion2;

  return {
    ...error,
    niceError: newError,
  };
}

function checkForBadEquals(
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) {
  if (typeof error.violatingObject.result !== "string") {
    return error;
  }

  if (
    !schemaPathMatches(error, ["object", "type"]) &&
    !schemaPathMatches(error, ["object", "propertyNames", "string", "pattern"])
  ) {
    return error;
  }

  if (
    !((error.violatingObject.result as string).match(/^.+ *= *.+$/))
  ) {
    return error;
  }

  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 =
    `In YAML, key-value pairs in objects must be separated by a colon and a space.`;
  const suggestion2 = `Did you mean ${
    quotedStringColor(
      quotedStringColor(getVerbatimInput(error)).replace(/ *= */g, ": "),
    )
  } instead?`;
  const newError: TidyverseError = {
    heading: formatHeadingForValueError(error, parse, schema),
    error: [errorMessage],
    info: {},
    location: error.niceError.location,
  };
  addInstancePathInfo(newError, error.instancePath);
  addFileInfo(newError, error.source);
  newError.info["yaml-key-value-pairs"] = suggestion1;
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
        throw new InternalError(
          "required schema error without a required field",
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
    throw new InternalError("required error on a non-object schema");
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

/**
 * Create a formatted string describing the surroundings of an error.
 * Used in the generation of nicely-formatted error messages.
 *
 * @param src the string containing the source of the error
 * @param location the location range in src
 * @returns a string containing a formatted description of the context around the error
 */
export function createSourceContext(
  src: MappedString,
  location: Range,
): string {
  if (src.value.length === 0) {
    // if the file is empty, don't try to create a source context
    return "";
  }
  const startMapResult = src.map(location.start, true);
  const endMapResult = src.map(location.end, true);

  const locF = mappedIndexToLineCol(src);

  let sourceLocation;
  try {
    sourceLocation = {
      start: locF(location.start),
      end: locF(location.end),
    };
  } catch (_e) {
    sourceLocation = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }

  if (startMapResult === undefined || endMapResult === undefined) {
    throw new InternalError(
      `createSourceContext called with bad location ${location.start}-${location.end}.`,
    );
  }

  if (startMapResult.originalString !== endMapResult.originalString) {
    throw new InternalError(
      "don't know how to create source context across different source files",
    );
  }
  const originalString = startMapResult.originalString;
  // TODO this is computed every time, might be inefficient on large files.
  const nLines = lines(originalString.value).length;

  const {
    start,
    end,
  } = sourceLocation;
  const {
    prefixWidth,
    lines: formattedLines,
  } = formatLineRange(
    originalString.value,
    Math.max(0, start.line - 1),
    Math.min(end.line + 1, nLines - 1),
  );
  const contextLines: string[] = [];
  let mustPrintEllipsis = true;
  for (const { lineNumber, content, rawLine } of formattedLines) {
    if (lineNumber < start.line || lineNumber > end.line) {
      if (rawLine.trim().length) {
        contextLines.push(content);
      }
    } else {
      if (
        lineNumber >= start.line + 2 && lineNumber <= end.line - 2
      ) {
        if (mustPrintEllipsis) {
          mustPrintEllipsis = false;
          contextLines.push("...");
        }
      } else {
        const startColumn = lineNumber > start.line ? 0 : start.column;
        const endColumn = lineNumber < end.line ? rawLine.length : end.column;
        contextLines.push(content);
        contextLines.push(
          " ".repeat(prefixWidth + startColumn - 1) +
            "~".repeat(endColumn - startColumn + 1),
        );
      }
    }
  }
  return contextLines.join("\n");
}

export function createLocalizedError(obj: {
  violatingObject: AnnotatedParse;
  instancePath: InstancePath;
  schemaPath: SchemaPath;
  source: MappedString;
  message: string;
  schema: Schema;
}): LocalizedError {
  const {
    violatingObject,
    instancePath,
    schemaPath,
    source,
    message,
    schema,
  } = obj;
  const locF = mappedIndexToLineCol(source);

  let location;
  try {
    location = {
      start: locF(violatingObject.start),
      end: locF(violatingObject.end),
    };
  } catch (_e) {
    location = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }

  const mapResult = source.map(violatingObject.start);
  const fileName = mapResult ? mapResult.originalString.fileName : undefined;
  return {
    source: mappedString(source, [{
      start: violatingObject.start,
      end: violatingObject.end,
    }]),
    violatingObject: violatingObject,
    instancePath,
    schemaPath,
    schema,
    message,
    location: location!,
    niceError: {
      heading: message,
      error: [],
      info: {},
      fileName,
      location: location!,
      sourceContext: createSourceContext(violatingObject.source, {
        start: violatingObject.start,
        end: violatingObject.end,
      }), // location!),
    },
  };
}
