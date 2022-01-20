/*
* yaml-schema.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// FIXME needs refactoring. This is mostly only used at build-js time,
// except for "parseAndValidate".

import { YAMLSchema } from "../lib/yaml-validation/yaml-schema.ts";
export { YAMLSchema } from "../lib/yaml-validation/yaml-schema.ts";
import { normalizeSchema } from "../lib/yaml-validation/schema.ts";
import { MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { loadDefaultSchemaDefinitions } from "./definitions.ts";
import { getSchemaDefinitionsObject } from "../lib/yaml-validation/schema.ts";
import { esbuildCompile } from "../esbuild.ts";
import { TempContext } from "../temp.ts";
import { dirname, relative } from "path/mod.ts";
import { resourcePath } from "../resources.ts";

let ajvInit = false;
// deno-lint-ignore no-explicit-any
let Ajv: any = undefined; // this is the module

// deno-lint-ignore no-explicit-any
let ajv: any = undefined; // this is the instance

/* we use a minimal dependency-injection setup here to decouple this
   library from the Ajv dependency. This allows us core-lib not to
   depend directly on Ajv, which in turn lets us use the UMD version
   of Ajv in the Javascript runtime as well as deno.

   Ideally, we'd do the same for the YAML parsers, which are different
   in deno and in the browser. At some point, we might want to shim over
   these two parsers and inject a common dependency into yaml-schema.

   Right now, we do this indirectly by expecting an AnnotatedParse as
   input to the validation class. It gets the job done but isn't very
   clean.
*/
// deno-lint-ignore no-explicit-any
export function setupAjv(_ajv: any) {
  ajv = _ajv;
}

export function getAjvInstance() {
  return ajv;
}

export async function ensureAjv() {
  if (!ajvInit) {
    let path = new URL(resourcePath("../core/lib/external/ajv-bundle.js"), import.meta.url).href;
    let mod = await import(path);
    Ajv = mod.default;
    ajv = new Ajv({
      allErrors: true,
      inlineRefs: false,
      verbose: true,
      code: {
        optimize: false,
        source: true
      },
    });
    ajvInit = true;
    await loadDefaultSchemaDefinitions();
  }
}

export async function exportStandaloneValidators(temp: TempContext) {
  await ensureAjv();
  const entries: Record<string, string> = {};
  const defs = getSchemaDefinitionsObject();
  const { standaloneCode } = Ajv;

  for (const [key, schema] of Object.entries(defs)) {
    entries[key] = schema.$id;
    
    // compile the schemas
    ajv.compile(normalizeSchema(schema));
  }
  const rawCode = standaloneCode(ajv, entries);
  const rawFilePath = temp.createFile({ suffix: ".js" });
  Deno.writeTextFileSync(rawFilePath, rawCode);

  // FIXME I don't quite understand why we need esbuild's workingDir
  // to be that of the tempfile but it fails otherwise..
  const result = await esbuildCompile(
    "",
    dirname(rawFilePath),
    ["--minify", rawFilePath],
    "esm",
  );
  return result!;
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
