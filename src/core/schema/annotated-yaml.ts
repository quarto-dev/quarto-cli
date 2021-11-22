/*
* annotated-yaml.ts
*
* Parses YAML and returns an annotated parse with location information
* to enable good error messages on validation
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { error, info } from "log/mod.ts";

import { parse } from "encoding/yaml.ts";

import { MappedString } from "../mapped-text.ts";

import { AnnotatedParse, LocalizedError } from "../lib/yaml-schema.ts";
import { withValidator } from "../lib/validator-queue.ts";

export type { AnnotatedParse } from "../lib/yaml-schema.ts";

import { ensureAjv } from "./yaml-schema.ts";

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

  parse(yml, { listener });

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

export async function readAndValidateYAML(
  schema: any,
  mappedYaml: MappedString,
  errorMessage: string): Promise<{
    yaml: { [key: string]: unknown },
    yamlValidationErrors: LocalizedError[]
  }>
{
  ensureAjv();
  
  const result = await withValidator(schema, (validator) => {
    const annotation = readAnnotatedYamlFromMappedString(mappedYaml);
    const validateYaml = !(annotation.result?.["validate-yaml"] === false);

    const yaml = annotation.result;
    if (validateYaml) {
      const valResult = validator.validateParse(mappedYaml, annotation);
      if (valResult.errors.length) {
        validator.reportErrorsInSource(
          {
            result: yaml,
            errors: valResult.errors
          }, mappedYaml!,
          errorMessage,
          error,
          info
        );
      }
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: valResult.errors
      };
    } else {
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: []
      };
    }
  });
  
  return result;
}
