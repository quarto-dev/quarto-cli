// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Schema } from "../schema.ts";
import { binary, merge, omap, pairs, set, timestamp } from "../_type/mod.ts";
import { CORE_SCHEMA } from "./core.ts";

/**
 * Default YAML schema. It is not described in the YAML specification.
 */
export const DEFAULT_SCHEMA: Schema = new Schema({
  explicit: [binary, omap, pairs, set],
  implicit: [timestamp, merge],
  include: [CORE_SCHEMA],
});

/**
 * Default YAML schema. It is not described in the YAML specification.
 *
 * @deprecated This will be removed in 1.0.0. Use {@link DEFAULT_SCHEMA} instead.
 */
export const def = DEFAULT_SCHEMA;
