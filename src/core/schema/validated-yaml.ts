/*
 * validated-yaml.ts
 *
 * helper functions for reading and validating YAML
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { existsSync } from "fs/exists.ts";
import { asMappedString } from "../mapped-text.ts";
import { Schema } from "../lib/yaml-schema/types.ts";
import { relative } from "../../deno_ral/path.ts";

import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "../lib/yaml-schema/validated-yaml.ts";

export { ValidationError } from "../lib/yaml-schema/validated-yaml.ts";

export async function readAndValidateYamlFromFile(
  file: string,
  schema: Schema,
  errorMessage: string,
  defaultContents?: string,
): Promise<unknown> {
  if (!existsSync(file)) {
    throw new Error(`YAML file ${file} not found.`);
  }

  let shortFileName = file;
  if (shortFileName.startsWith("/")) {
    shortFileName = relative(Deno.cwd(), shortFileName);
  }

  let fileContents = Deno.readTextFileSync(file).trimEnd();
  if ((fileContents.trim().length === 0) && defaultContents) {
    fileContents = defaultContents;
  }

  const contents = asMappedString(
    fileContents,
    shortFileName,
  );
  const {
    yaml,
    yamlValidationErrors,
  } = await readAndValidateYamlFromMappedString(contents, schema);

  if (yamlValidationErrors.length) {
    throw new ValidationError(errorMessage, yamlValidationErrors);
  }
  return yaml;
}
