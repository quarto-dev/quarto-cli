/*
 * types.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { TidyverseError } from "../errors-types.ts";
import { MappedString } from "../text-types.ts";
import {
  AnnotatedParse,
  JSONValue,
  LocalizedError,
  Schema,
} from "../yaml-schema/types.ts";

export interface ValidatedParseResult {
  result: JSONValue;
  errors: LocalizedError[];
}

export type ValidatorErrorHandlerFunction = (
  error: LocalizedError,
  parse: AnnotatedParse,
  /* this is the _outer_ schema, which failed the validation of
   * parse.result. error also holds error.schema, which is a subschema
   * of the outer schema which failed the validation of
   * error.violatingObject (a subobject of parse.result).
   */
  schema: Schema,
) => LocalizedError | null;

export interface YAMLSchemaT {
  schema: Schema;

  errorHandlers: ValidatorErrorHandlerFunction[];

  addHandler(
    handler: ValidatorErrorHandlerFunction,
  ): void;

  transformErrors(
    annotation: AnnotatedParse,
    errors: LocalizedError[],
  ): LocalizedError[];

  validateParse(
    src: MappedString,
    annotation: AnnotatedParse,
  ): Promise<ValidatedParseResult>;

  reportErrorsInSource(
    result: ValidatedParseResult,
    _src: MappedString,
    message: string,
    // deno-lint-ignore no-explicit-any
    error: (a: string) => any,
    log: (a: TidyverseError) => unknown,
  ): ValidatedParseResult;
}
