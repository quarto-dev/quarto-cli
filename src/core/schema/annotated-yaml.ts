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
import { asMappedString, MappedString, mappedString } from "../mapped-text.ts";
import { AnnotatedParse, JSONValue } from "../lib/yaml-validation/types.ts";

export function readAnnotatedYamlFromMappedString(mappedYaml: MappedString) {
  const yml = mappedYaml.value;

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

      if (rawRange.trim().length === 0) {
        // special case for when string is empty
        results.push({
          start: position - rightTrim,
          end: position - rightTrim,
          result: result as JSONValue,
          components,
          kind,
          source: mappedString(mappedYaml, [{
            start: position - rightTrim,
            end: position - rightTrim,
          }]),
        });
      } else {
        results.push({
          start: openPosition + leftTrim,
          end: position - rightTrim,
          result: result,
          components,
          kind,
          source: mappedString(mappedYaml, [{
            start: position + leftTrim,
            end: position - rightTrim,
          }]),
        });
      }
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
      source: mappedString(mappedYaml, [{ start: 0, end: 0 }]),
    };
  }
  if (results.length !== 1) {
    throw new Error(
      `Internal Error - expected a single result, got ${results.length} instead`,
    );
  }

  JSON.stringify(results[0]); // this will throw on circular structures
  return results[0];
}

export function readAnnotatedYamlFromString(yml: string) {
  return readAnnotatedYamlFromMappedString(asMappedString(yml));
}
