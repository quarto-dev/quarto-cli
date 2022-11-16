/*
* constants.ts
*
* Constants for the YAML validator
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  BooleanSchema,
  NullSchema,
  NumberSchema,
  StringSchema,
} from "./types.ts";

export const booleanSchema: BooleanSchema = {
  "type": "boolean",
  "description": "be `true` or `false`",
  "completions": ["true", "false"],
  "exhaustiveCompletions": true,
};

export const numberSchema: NumberSchema = {
  "type": "number",
  "description": "be a number",
};

export const integerSchema: NumberSchema = {
  "type": "integer",
  "description": "be an integral number",
};

export const stringSchema: StringSchema = {
  "type": "string",
  "description": "be a string",
};

// NB this is different from a schema that accepts nothing
// this schema accepts `null`
export const nullSchema: NullSchema = {
  "type": "null",
  "description": "be the null value",
  "completions": ["null"],
  "exhaustiveCompletions": true,
};
