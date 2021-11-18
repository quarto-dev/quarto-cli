/*
* yaml-schema.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import Ajv from "ajv";
import { setupAjv } from "../lib/yaml-schema.ts";
import { YAMLSchema } from "../lib/yaml-schema.ts";
export { YAMLSchema } from "../lib/yaml-schema.ts";
import { MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";

setupAjv(new Ajv({ allErrors: true }));

// This function isn't in YAMLSchema because
// readAnnotatedYamlFromMappedString depends on a yaml library we do
// not use on core/lib
export function parseAndValidate(
  src: MappedString,
  validator: YAMLSchema,
) {
  const parse = readAnnotatedYamlFromMappedString(src);
  return validator.validateParse(src, parse);
}
