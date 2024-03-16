// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * @deprecated (will be removed in 0.219.0) `"=="`, `"==="`, `"!=="` and `""` operators are deprecated. Use `"="`, `"!="` or `undefined` instead.
 */
export const OPERATORS = [
  "",
  "=",
  "==",
  "===",
  "!==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
] as const;
