/*
 * yaml-schema.ts
 *
 * A class to manage YAML Schema validation and associated tasks like
 * error localization
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { MappedString } from "../text-types.ts";

import { TidyverseError } from "../errors-types.ts";
import { ValidatorErrorHandlerFunction } from "./types.ts";

import { validate } from "./validator.ts";
import { ValidatedParseResult } from "./types.ts";

import {
  AnnotatedParse,
  LocalizedError,
  Schema,
} from "../yaml-schema/types.ts";

////////////////////////////////////////////////////////////////////////////////

export class YAMLSchema {
  schema: Schema;

  // These are schema-specific error transformers to yield custom
  // error messages.

  errorHandlers: ValidatorErrorHandlerFunction[];
  constructor(schema: Schema) {
    this.errorHandlers = [];
    this.schema = schema;
  }

  addHandler(
    handler: ValidatorErrorHandlerFunction,
  ) {
    this.errorHandlers.push(handler);
  }

  transformErrors(
    annotation: AnnotatedParse,
    errors: LocalizedError[],
  ): LocalizedError[] {
    return errors.map((error) => {
      for (const handler of this.errorHandlers) {
        const localError = handler(error, annotation, this.schema);
        if (localError === null) {
          return null;
        }
        error = localError;
      }
      return error;
    }).filter((error) => error !== null) as LocalizedError[];
  }

  // deno-lint-ignore require-await
  async validateParse(
    src: MappedString,
    annotation: AnnotatedParse,
    pruneErrors = true,
  ) {
    const validationErrors = validate(
      annotation,
      this.schema,
      src,
      pruneErrors,
    );

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
    _src: MappedString,
    message: string,
    // deno-lint-ignore no-explicit-any
    error: (a: string) => any,
    log: (a: TidyverseError) => unknown,
  ) {
    if (result.errors.length) {
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
