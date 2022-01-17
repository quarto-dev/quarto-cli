/*
* yaml-schema.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import Ajv from "../lib/external/ajv-bundle.js";
import { getAjvInstance, setupAjv, YAMLSchema } from "../lib/yaml-schema.ts";
export { YAMLSchema } from "../lib/yaml-schema.ts";
import { resourcePath } from "../resources.ts";
import { MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { loadDefaultSchemaDefinitions } from "./definitions.ts";
import { getSchemaDefinitionsObject } from "../lib/schema.ts";
import { esbuildCompile } from "../esbuild.ts";
import { TempContext } from "../temp.ts";
import { dirname } from "path/mod.ts";

let ajvInit = false;
export async function ensureAjv() {
  if (!ajvInit) {
    setupAjv(new Ajv({ allErrors: true, inlineRefs: false, verbose: true, code: { optimize: false, source: true } }));
    ajvInit = true;
    await loadDefaultSchemaDefinitions();
  }
}

export async function exportStandaloneValidators(temp: TempContext)
{
  await ensureAjv();
  const entries: Record<string, string> = {};
  const defs = getSchemaDefinitionsObject();
  const { standaloneCode } = Ajv;
  
  for (const [key, schema] of Object.entries(defs)) {
    // console.log({ key, id: (schema as any).$id });
    entries[key] = schema.$id;
  }
  const rawCode = standaloneCode(getAjvInstance(), entries);
  const rawFilePath = temp.createFile({ suffix: ".js" });
  Deno.writeTextFileSync(rawFilePath, rawCode);

  // FIXME I don't quite understand why we need esbuild's workingDir
  // to be that of the tempfile but it fails otherwise..
  const result = await esbuildCompile(
    "", dirname(rawFilePath), ["--minify", rawFilePath], "esm");
  return result!;
}

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
