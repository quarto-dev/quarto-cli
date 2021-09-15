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

export interface AnnotatedParse
{
  start: number,
  end: number,
  result: any,
  kind: string,
  components: AnnotatedParse[]
};

export function readAnnotatedYamlFromString(yml: string)
{
  const stack: any[] = [];
  const results: AnnotatedParse[] = [];

  function listener(what: string, state: any)
  {
    const { result, line, position, kind } = state;
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
      const components: any[] = [];
      while (results.length > 0) {
        const last = results[results.length - 1];
        if (last.end <= openPosition) {
          break;
        }
        components.push(results.pop());
      }
      components.reverse();
      results.push({
        start: openPosition,
        end: position,
        result: result,
        components, kind
      });
    } else {
      stack.push({ position });
    }
  }

  const parsed = parse(yml, { listener });
  if (results.length !== 1) {
    throw new Error(`Internal Error - expected a single result, got ${results.length} instead`);
  }
  return results[0];
}
