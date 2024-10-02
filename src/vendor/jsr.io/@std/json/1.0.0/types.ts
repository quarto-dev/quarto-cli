// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** The type of the result of parsing JSON. */
export type JsonValue =
  | { [key: string]: JsonValue | undefined }
  | JsonValue[]
  | string
  | number
  | boolean
  | null;
