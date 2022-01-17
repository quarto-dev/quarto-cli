/*
* annotated-yaml.ts
*
* Parses YAML and returns an annotated parse with location information
* to enable good error messages on validation
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { JSON_SCHEMA, parse } from "encoding/yaml.ts";
import { MappedString } from "../mapped-text.ts";
import { AnnotatedParse } from "../lib/yaml-schema.ts";

export type { AnnotatedParse } from "../lib/yaml-schema.ts";

export function readAnnotatedYamlFromMappedString(yml: MappedString) {
  return readAnnotatedYamlFromString(yml.value);
}

export function readAnnotatedYamlFromString(yml: string) {
  // deno-lint-ignore no-explicit-any
  const stack: any[] = [];
  const results: AnnotatedParse[] = [];

  // deno-lint-ignore no-explicit-any
  function listener(what: string, state: any) {
    const { result, position, kind } = state;
    if (what === "close") {
      const { position: openPosition } = stack.pop();
      if (results.length > 0) {
        const last = results[results.length - 1];
        // sometimes we get repeated instances of (start, end) pairs
        // (probably because of recursive calls in parse() that don't
        // consume the string) so we skip those explicitly here
        if (last.start === openPosition && last.end === position) {
          return;
        }
      }
      // deno-lint-ignore no-explicit-any
      const components: any[] = [];
      while (results.length > 0) {
        const last = results[results.length - 1];
        if (last.end <= openPosition) {
          break;
        }
        components.push(results.pop());
      }
      components.reverse();

      const rawRange = yml.substring(openPosition, position);
      // trim spaces if needed
      const leftTrim = rawRange.length - rawRange.trimLeft().length;
      const rightTrim = rawRange.length - rawRange.trimRight().length;
      results.push({
        start: openPosition + leftTrim,
        end: position - rightTrim,
        result: result,
        components,
        kind,
      });
    } else {
      stack.push({ position });
    }
  }

  parse(yml, { listener, schema: JSON_SCHEMA });

  if (results.length === 0) {
    return {
      start: 0,
      end: 0,
      result: null,
      kind: "null",
      components: [],
    };
  }
  if (results.length !== 1) {
    throw new Error(
      `Internal Error - expected a single result, got ${results.length} instead`,
    );
  }
  return results[0];
}
