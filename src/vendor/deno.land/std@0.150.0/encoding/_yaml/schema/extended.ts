// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { Schema } from "../schema.ts";
import { regexp, undefinedType } from "../type/mod.ts";
import { def } from "./default.ts";

// Extends JS-YAML default schema with additional JavaScript types
// It is not described in the YAML specification.
export const extended = new Schema({
  explicit: [regexp, undefinedType],
  include: [def],
});
