/*
* yaml-schema.ts
*
* A class to manage YAML Schema validation and associated tasks like
* error localization
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { mappedIndexToRowCol, MappedString } from "../mapped-text.ts";

import { formatLineRange, lines } from "../text.ts";

import {
  addFileInfo,
  addInstancePathInfo,
  ErrorLocation,
  quotedStringColor,
  TidyverseError,
  tidyverseFormatError,
} from "../errors.ts";

import * as colors from "../external/colors.ts";

import { getSchemaDefinition, Schema } from "./schema.ts";

import { ErrorObject, stagedValidator } from "./staged-validator.ts";

////////////////////////////////////////////////////////////////////////////////

export interface AnnotatedParse {
  start: number;
  end: number;
  // deno-lint-ignore no-explicit-any
  result: any;
  kind: string;
  components: AnnotatedParse[];
}

export interface LocalizedError {
  source: MappedString;
  violatingObject: AnnotatedParse;
  instancePath: string;
  message: string;
  location: ErrorLocation;
  niceError: TidyverseError;
  // deno-lint-ignore no-explicit-any
  ajvError?: any; // upstream error object from ajv
}

export function getVerbatimInput(error: LocalizedError) {
  return error.source.value.substring(
    error.violatingObject.start,
    error.violatingObject.end,
  );
}

function navigate(
  path: string[],
  annotation: AnnotatedParse | undefined,
  returnKey = false, // if true, then return the *key* entry as the final result rather than the *value* entry.
  pathIndex = 0,
): AnnotatedParse {
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
      // for (let i = 0; i < components.length; i += 2) {
      const key = components[i]!.result;
      if (key === searchKey) {
        if (returnKey && pathIndex === path.length - 1) {
          return navigate(path, components[i], returnKey, pathIndex + 1);
        } else {
          return navigate(path, components[i + 1], returnKey, pathIndex + 1);
        }
      }
    }
    throw new Error(
      `Internal error: searchKey ${searchKey} (path: ${path}) not found in mapping object`,
    );
  } else if (
    ["sequence", "block_sequence", "flow_sequence"].indexOf(annotation.kind) !== -1
  ) {
    const searchKey = Number(path[pathIndex]);
    return navigate(
      path,
      annotation.components[searchKey],
      returnKey,
      pathIndex + 1,
    );
  } else {
    throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}

function navigateSchema(
  path: string[],
  schema: Schema,
  pathIndex = 0,
): Schema[] {
  if (schema.$ref) {
    schema = getSchemaDefinition(schema.$ref);
  }
  if (pathIndex >= path.length - 1) {
    return [schema];
  }
  const pathVal = path[pathIndex];
  // allOf doesn't appear to trigger a new path in the schemapath, so
  // we have to check if the _current_ schema is an allOf, and just
  // iterate over all of them and concatenate. Maybe? :shrug: ?
  if (schema.allOf !== undefined) {
    return schema.allOf.map((s: Schema) => navigateSchema(path, s, pathIndex))
      .flat();
  } else if (pathVal === "patternProperties" && schema.patternProperties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.patternProperties[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "properties" && schema.properties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.properties[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "anyOf" && schema.anyOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.anyOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "oneOf" && schema.oneOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.oneOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "items" && schema.items) {
    const subSchema = schema.items;
    return navigateSchema(path, subSchema, pathIndex + 1);
  } else {
    return [];
  }
}

function isProperPrefix(a: string, b: string) {
  return (b.length > a.length) && b.substring(0, a.length) === a;
}

function groupBy<A>(
  lst: A[],
  f: (v: A) => string,
): { key: string; values: A[] }[] {
  const record: Record<string, A[]> = {};
  const result: { key: string; values: A[] }[] = [];
  for (const el of lst) {
    const key = f(el);
    if (record[key] === undefined) {
      const lst: A[] = [];
      const entry = {
        key,
        values: lst,
      };
      record[key] = lst;
      result.push(entry);
      // NB the deliberate sharing of `lst` here
    }
    record[key].push(el);
  }
  return result;
}

function groupByEntries<A>(entries: { key: string; values: A[] }[]): A[] {
  const result = [];
  for (const { values } of entries) {
    result.push(...values);
  }
  return result;
}

function narrowOneOfError(
  oneOf: ErrorObject,
  suberrors: ErrorObject[],
): ErrorObject[] {
  const subschemaErrors = groupBy(
    suberrors.filter((error) => error.schemaPath !== oneOf.schemaPath),
    (error) => error.schemaPath.substring(0, error.schemaPath.lastIndexOf("/")),
  );

  // if we find a subschema that has only "additionalProperties" errors
  // narrow only to those.
  const onlyAdditionalProperties = subschemaErrors.filter(
    ({ values }) => values.every((v) => v.keyword === "additionalProperties"),
  );
  if (onlyAdditionalProperties.length) {
    return onlyAdditionalProperties[0].values;
  }

  // otherwise, we give up, and don't report anything; this has the
  // effect of not narrowing the error.
  return [];
}

/*
 * This attempts to prune the large number of errors reported by avj.
 *
 * We get a large number of errors in ajv because we have to run it
 * with "allErrors: true" in order to get the IDE validation prompts
 * over the entirety of the file.
 *
 * To prune the errors, we apply two general heuristics:
 *
 * 1. if there are errors in two instance paths, and one error is in a
 *    prefix of another error, we only report the innermost error (the
 *    principle here is that inner instances are smaller, and it's
 *    easier to wrap your head around fixing an error in a smaller
 *    instance than it is on a large one, and maybe fixing the smaller
 *    error also fixes the larger error.)
 *
 * 2. For errors in the _same_ instance path, we always choose at most
 *    one error to display. The principle here is that fixing this
 *    error is likely to change the other errors on a second attempt,
 *    and so we don't want to overwhelm the user with multiple reports
 *    on the same location.
 *
 */
function localizeAndPruneErrors(
  annotation: AnnotatedParse,
  validationErrors: ErrorObject[],
  source: MappedString,
  schema: Schema,
) {
  const result: LocalizedError[] = [];

  const locF = mappedIndexToRowCol(source);

  /////// Error pruning
  //
  // there are a number of things which interact with one another delicately here.
  //
  // 1. because we're trying to report
  // only the innermost errors, we need to prune proper prefixes in instancePaths.
  //
  // 2. because we're trying to _localize_ errors, we transform errors about invalid additionalProperties by
  // making them _more specific_. This makes them deeper, and more likely to stick
  // around after filtering. In particular, if step 1 prunes an error, it should prune all
  // the "transformed" errors that come from the proper prefixes as well.
  //
  // 3. Some of the additionalProperties errors come from "internal" schemas. For example,
  // we have a schema that says a field can be one of:
  // - a) an object with "section" and "contents" keys and no other keys
  // - b) an object with "href" and "text" keys but no other keys
  // - c) a string
  //
  // If this schema fails because of a bad property, then "text" and
  // "href" are considered bad properties as well because they fail
  // schema a)
  //
  // We can't escape this error report because we need "allErrors" to be reported
  // to create good lints.

  let errorsPerInstanceList = groupBy(
    validationErrors,
    (error) => error.instancePath,
  );

  do {
    const newErrors: ErrorObject[] = [];

    // prune proper prefixes of instancePaths
    errorsPerInstanceList = errorsPerInstanceList.filter(
      ({ key: pathA }) =>
        errorsPerInstanceList.filter(
          ({ key: pathB }) => isProperPrefix(pathA, pathB),
        ).length === 0,
    );

    for (const { key: instancePath, values: errors } of errorsPerInstanceList) {
      // Find the broadest schemaPath errors
      let errorsPerSchemaList = groupBy(errors, (error) => error.schemaPath);
      errorsPerSchemaList = errorsPerSchemaList.filter(
        ({ key: pathA }) =>
          errorsPerSchemaList.filter(
            ({ key: pathB }) => isProperPrefix(pathB, pathA),
          ).length === 0,
      );

      for (const error of groupByEntries(errorsPerSchemaList)) {
        if (error.hasBeenTransformed) {
          continue;
        }
        if (error.keyword === "oneOf") {
          error.hasBeenTransformed = true;
          newErrors.push(...narrowOneOfError(error, errors));
        } else if (error.keyword === "additionalProperties") {
          error.hasBeenTransformed = true;
          newErrors.push({
            ...error,
            instancePath: `${instancePath}/${error.params.additionalProperty}`,
            keyword: "_custom_invalidProperty",
            message:
              `property ${error.params.additionalProperty} not allowed in object`,
            params: {
              ...error.params,
              originalError: error,
            },
            schemaPath: error.schemaPath.slice(0, -21), // drop "/additionalProperties",
          });
        }
      }
    }

    if (newErrors.length) {
      errorsPerInstanceList.push(
        ...groupBy(newErrors, (error) => error.instancePath),
      );
    } else {
      break;
    }
  } while (true);

  for (
    const { key: instancePath, values: allErrors } of errorsPerInstanceList
  ) {
    const path = instancePath.split("/").slice(1);

    // now, we keep only the errors with _schemaPaths_ that are the most _general_
    // ie, we filter out those that have other proper prefixes

    const errors = allErrors.filter(({ schemaPath: pathA }) =>
      !(allErrors.filter(({ schemaPath: pathB }) =>
        isProperPrefix(pathB, pathA)
      ).length > 0)
    );

    for (const error of errors) {
      const returnKey = error.keyword === "_custom_invalidProperty";
      const violatingObject = navigate(path, annotation, returnKey);
      const schemaPath = error.schemaPath.split("/").slice(1);

      const start = locF(violatingObject.start);
      const end = locF(violatingObject.end);

      let niceError = {
        heading: "",
        error: [],
        info: [],
        location: { start, end },
      };

      // in the case of customized errors, use message we prepared earlier
      if (error.keyword.startsWith("_custom_")) {
        niceError = {
          ...niceError,
          heading: error.message === undefined ? "" : error.message,
        };
      } else {
        if (instancePath === "") {
          niceError = {
            ...niceError,
            heading: `(top-level error) ${error.message}`,
          };
        } else {
          const errorSchema = (error.params && error.params.schema) ||
            error.parentSchema;
          const innerSchema = errorSchema
            ? [errorSchema]
            : navigateSchema(schemaPath.map(decodeURIComponent), schema);
          if (innerSchema.length === 0) {
            // this is probably an internal error..
            niceError = {
              ...niceError,
              heading: `Schema ${schemaPath}: ${error.message}`,
            };
          } else {
            const rawVerbatimInput = source.value.substring(
              violatingObject.start,
              violatingObject.end,
            );
            if (rawVerbatimInput.length === 0) {
              niceError = {
                ...niceError,
                heading: `Empty value found where it must instead ${
                innerSchema.map((s) => s.description).join(", ")
                }.`
              };
            } else {
              // TODO until we have verbose options, this hurts the IDE output.
              // const idTag = (errorSchema && errorSchema.$id) ? ` ${colors.gray("(schema id: " + errorSchema.$id + ")")}` : "";
              const verbatimInput = quotedStringColor(
                source.value.substring(
                  violatingObject.start,
                  violatingObject.end,
                ),
              );
              niceError = {
                ...niceError,
                heading: `The value ${verbatimInput} must ${
                innerSchema.map((s) => s.description).join(", ")
                }.`,
              };
            }
          }
        }
      }
      niceError.location = { start, end };
      addFileInfo(niceError, source);
      addInstancePathInfo(niceError, instancePath);

      result.push({
        instancePath,
        message: error.message === undefined ? "" : error.message,
        violatingObject,
        location: { start, end },
        source,
        ajvError: error, // we include the full AJV error to allow downstream fine-tuning
        niceError: niceError,
      });
    }
  }

  result.sort((a, b) => a.violatingObject.start - b.violatingObject.start);
  return result;
}

interface ValidatedParseResult {
  // deno-lint-ignore no-explicit-any
  result: any;
  errors: LocalizedError[];
}

// NB: YAMLSchema is not reentrant because ajv isn't - see the use of
// the "errors" field in the validate closure (!). We work around this in
// automation.js by using a request queue that serializes validation
// requests over any one schema.

export class YAMLSchema {
  schema: Schema; // TODO I haven't found typescript typings for JSON Schema
  // deno-lint-ignore no-explicit-any
  validate: any; // TODO find the typing for this

  // These are schema-specific error transformers to yield custom
  // error messages.
  errorHandlers: ((
    error: LocalizedError,
    annotation: AnnotatedParse,
    schema: Schema,
  ) => LocalizedError)[];

  constructor(schema: Schema) {
    this.errorHandlers = [];
    this.schema = schema;
    this.validate = stagedValidator(this.schema);
  }

  addHandler(
    handler: (
      error: LocalizedError,
      annotation: AnnotatedParse,
      schema: Schema,
    ) => LocalizedError,
  ) {
    this.errorHandlers.push(handler);
  }

  transformErrors(
    annotation: AnnotatedParse,
    errors: LocalizedError[],
  ) {
    return errors.map((error) => {
      for (const handler of this.errorHandlers) {
        error = handler(error, annotation, this.schema);
      }
      return error;
    });
  }

  async validateParse(
    src: MappedString,
    annotation: AnnotatedParse,
  ) {
    const validationErrors = await this.validate(annotation.result);

    if (validationErrors.length) {
      const localizedErrors = this.transformErrors(
        annotation,
        localizeAndPruneErrors(
          annotation,
          validationErrors,
          src,
          this.schema,
        ),
      );
      return {
        result: annotation.result,
        errors: localizedErrors,
      };
    } else {
      return {
        result: annotation.result,
        errors: [],
      };
    }
  }

  // NB this needs explicit params for "error" and "log" because it might
  // get called from the IDE, where we lack quarto's "error" and "log"
  // infra
  reportErrorsInSource(
    result: ValidatedParseResult,
    src: MappedString,
    message: string,
    // deno-lint-ignore no-explicit-any
    error: (a: string) => any,
    // deno-lint-ignore no-explicit-any
    log: (a: string) => any,
  ) {
    if (result.errors.length) {
      const locF = mappedIndexToRowCol(src);
      const nLines = lines(src.originalString).length;
      error(message);
      for (const err of result.errors) {
        // log(err.message);
        // attempt to trim whitespace from error report
        let startO = err.violatingObject.start;
        let endO = err.violatingObject.end;
        while (
          (src.mapClosest(startO)! < src.originalString.length - 1) &&
          src.originalString[src.mapClosest(startO)!].match(/\s/)
        ) {
          startO++;
        }
        while (
          (src.mapClosest(endO)! > src.mapClosest(startO)!) &&
          src.originalString[src.mapClosest(endO)!].match(/\s/)
        ) {
          endO--;
        }
        const start = locF(startO);
        const end = locF(endO);
        const {
          prefixWidth,
          lines,
        } = formatLineRange(
          src.originalString,
          Math.max(0, start.line - 1),
          Math.min(end.line + 1, nLines - 1),
        );
        const contextLines: string[] = [];
        for (const { lineNumber, content, rawLine } of lines) {
          contextLines.push(content);
          if (lineNumber >= start.line && lineNumber <= end.line) {
            const startColumn = (lineNumber > start.line ? 0 : start.column);
            const endColumn = (lineNumber < end.line
              ? rawLine.length
              : end.column);
            contextLines.push(
              " ".repeat(prefixWidth + startColumn) +
                colors.blue("~".repeat(endColumn - startColumn + 1)),
            );
          }
        }
        err.niceError.sourceContext = contextLines.join("\n");
        log(tidyverseFormatError(err.niceError));
      }
    }
    return result;
  }

  // NB this needs explicit params for "error" and "log" because it might
  // get called from the IDE, where we lack quarto's "error" and "log"
  // infra
  async validateParseWithErrors(
    src: MappedString,
    annotation: AnnotatedParse,
    message: string,
    // deno-lint-ignore no-explicit-any
    error: (a: string) => any,
    // deno-lint-ignore no-explicit-any
    log: (a: string) => any,
  ) {
    const result = await this.validateParse(src, annotation);
    this.reportErrorsInSource(result, src, message, error, log);
    return result;
  }
}
