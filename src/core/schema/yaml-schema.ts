/*
* yaml-schema.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// FIXME needs refactoring. This is mostly only used at build-js time,
// except for "parseAndValidate".

import { YAMLSchema } from "../lib/yaml-validation/yaml-schema.ts";
import { MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { loadDefaultSchemaDefinitions } from "./definitions.ts";

let ajvInit = false;

export async function ensureAjv() {
  if (!ajvInit) {
    ajvInit = true;
    await loadDefaultSchemaDefinitions();
  }
}

// This function isn't in YAMLSchema because
// readAnnotatedYamlFromMappedString depends on a yaml library we do
// not use on core/lib
export async function parseAndValidate(
  src: MappedString,
  validator: YAMLSchema,
) {
  const parse = readAnnotatedYamlFromMappedString(src);
  return await validator.validateParse(src, parse);
}
