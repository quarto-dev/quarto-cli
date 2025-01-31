// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { CORE_SCHEMA } from "./core.ts";
import { DEFAULT_SCHEMA } from "./default.ts";
import { EXTENDED_SCHEMA } from "./extended.ts";
import { FAILSAFE_SCHEMA } from "./failsafe.ts";
import { JSON_SCHEMA } from "./json.ts";
export {
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  EXTENDED_SCHEMA,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
};

export function replaceSchemaNameWithSchemaClass(
  options?: {
    schema?: "core" | "default" | "failsafe" | "json" | "extended" | unknown;
  },
) {
  switch (options?.schema) {
    case "core":
      options.schema = CORE_SCHEMA;
      break;
    case "default":
      options.schema = DEFAULT_SCHEMA;
      break;
    case "failsafe":
      options.schema = FAILSAFE_SCHEMA;
      break;
    case "json":
      options.schema = JSON_SCHEMA;
      break;
    case "extended":
      options.schema = EXTENDED_SCHEMA;
      break;
  }
}
