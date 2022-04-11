/*
* js-yaml-schema.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

/* Quarto yaml schema
*
* We need to define a quarto yaml schema to support !expr tags without failing
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
