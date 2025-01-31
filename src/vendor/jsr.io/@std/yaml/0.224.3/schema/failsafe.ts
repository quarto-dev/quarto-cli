// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Schema } from "../schema.ts";
import { map, seq, str } from "../_type/mod.ts";

/**
 * Standard YAML's failsafe schema.
 *
 * @see {@link http://www.yaml.org/spec/1.2/spec.html#id2802346}
 */
export const FAILSAFE_SCHEMA: Schema = new Schema({
  explicit: [str, seq, map],
});

/**
 * Standard YAML's failsafe schema.
 *
 * @see {@link http://www.yaml.org/spec/1.2/spec.html#id2802346}
 *
 * @deprecated This will be removed in 1.0.0. Use {@link FAILSAFE_SCHEMA} instead.
 */
export const failsafe = FAILSAFE_SCHEMA;
