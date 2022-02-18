/*
* yaml-schema.ts
*
* A class to manage YAML Schema validation and associated tasks like
* error localization
*
* Copyright (C) 2022 by RStudio, PBC
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
} from "../errors.ts";

import * as colors from "../external/colors.ts";

import { getSchemaDefinition, Schema } from "./schema.ts";

import { navigateSchemaBySchemaPath } from "./schema-navigation.ts";

import { validate } from "./validator/validator.ts";

import { ErrorObject, getBadKey } from "./ajv-error.ts";

import {
  AnnotatedParse,
  JSONValue,
  LocalizedError,
} from "./validator/types.ts";

import { resolveSchema } from "./schema-utils.ts";

////////////////////////////////////////////////////////////////////////////////

export function getVerbatimInput(error: LocalizedError) {
  return error.source.value;
}

// this supports AnnotatedParse results built
// from deno yaml as well as tree-sitter.
export function navigate(
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
    // throw new Error(
    //   `Internal error: searchKey ${searchKey} (path: ${path}) not found in mapping object`,
    // );
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
    // throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}

interface ValidatedParseResult {
  // deno-lint-ignore no-explicit-any
  result: JSONValue;
  errors: LocalizedError[];
}

// NB: YAMLSchema is not reentrant because ajv isn't - see the use of
// the "errors" field in the validate closure (!). We work around this in
// automation.js by using a request queue that serializes validation
// requests over any one schema.

export class YAMLSchema {
  schema: Schema;
  // deno-lint-ignore no-explicit-any

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
    const validationErrors = validate(annotation, this.schema, src);

    if (validationErrors.length) {
      const localizedErrors = this.transformErrors(
        annotation,
        validationErrors,
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
    log: (a: TidyverseError) => unknown,
  ) {
    if (result.errors.length) {
      const nLines = lines(src.originalString).length;
      if (message.length) {
        error(message);
      }
      for (const err of result.errors) {
        log(err.niceError);
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
    log: (a: TidyverseError) => unknown,
  ) {
    const result = await this.validateParse(src, annotation);
    this.reportErrorsInSource(result, src, message, error, log);
    return result;
  }
}
