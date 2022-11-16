/*
* js-yaml-schema.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

/* Quarto yaml schema
*
* We need to define a quarto yaml schema to support !expr tags without failing.
*
* Note that this file needs to track the definitions in src/core/yaml.ts, but we
* but we duplicate them here because lib uses js-yaml, and src/core uses the deno standard library.
*
* It's very possible that we should src/core.yaml.ts wholesale into whatever lib does.
*/

import {
  _null, // this is "nil" in deno's version...? :shrug:
  bool,
  failsafe,
  float,
  int,
  Schema,
  Type,
} from "../external/js-yaml.js";

// Standard YAML's JSON schema + an expr tag handler ()
// http://www.yaml.org/spec/1.2/spec.html#id2803231
export const QuartoJSONSchema = new Schema({
  implicit: [_null, bool, int, float],
  include: [failsafe],
  explicit: [
    new Type("!expr", {
      kind: "scalar",
      // deno-lint-ignore no-explicit-any
      construct(data: any): Record<string, unknown> {
        const result: string = data !== null ? data : "";
        return {
          value: result,
          tag: "!expr",
        };
      },
    }),
  ],
});
