// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Schema } from "../schema.ts";
import { bool, float, int, nil } from "../_type/mod.ts";
import { FAILSAFE_SCHEMA } from "./failsafe.ts";

/**
 * Standard YAML's JSON schema.
 *
 * @see {@link http://www.yaml.org/spec/1.2/spec.html#id2803231}
 *
 * @deprecated This will be removed in 1.0.0. Use {@link JSON_SCHEMA} instead.
 */
export const JSON_SCHEMA: Schema = new Schema({
  implicit: [nil, bool, int, float],
  include: [FAILSAFE_SCHEMA],
});
