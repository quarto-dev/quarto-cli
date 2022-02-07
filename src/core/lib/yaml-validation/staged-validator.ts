/*
* staged-validator.ts
*
* FINISHME this won't be necessary anymore.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { AnnotatedParse, LocalizedError, Schema } from "./validator/types.ts";

import { MappedString } from "../mapped-text.ts";

import { validate } from "./validator/validator.ts";

export function stagedValidator(
  schema: Schema,
  value: AnnotatedParse,
  source: MappedString,
): LocalizedError[] {
  return validate(value, schema, source);
}
