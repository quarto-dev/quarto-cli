/*
* yaml-schema.ts
*
* A class to manage YAML Schema validation and associated tasks like
* error localization
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import Ajv from 'ajv';
import { AnnotatedParse, readAnnotatedYamlFromString } from "./annotated-yaml.ts";

const ajv = new Ajv({ allErrors: true });

////////////////////////////////////////////////////////////////////////////////

// deno-lint-ignore no-explicit-any
export type JSONSchema = any;

// NB we change the params field from the URL above to be able to inspect the
// value
export interface ErrorObject {
  keyword: string // validation keyword.
  instancePath: string // JSON Pointer to the location in the data instance (e.g., `"/prop/1/subProp"`).
  schemaPath: string // JSON Pointer to the location of the failing keyword in the schema
// deno-lint-ignore no-explicit-any
  params: any, // type is defined by keyword value, see below
  // params property is the object with the additional information about error
  // it can be used to generate error messages
  // (e.g., using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n) package).
  // See below for parameters set by all keywords.
  propertyName?: string // set for errors in `propertyNames` keyword schema.
                        // `instancePath` still points to the object in this case.
  message?: string // the error message (can be excluded with option `messages: false`).
  // Options below are added with `verbose` option:
  // deno-lint-ignore no-explicit-any
  schema?: any // the value of the failing keyword in the schema.
  parentSchema?: object // the schema containing the keyword.
  // deno-lint-ignore no-explicit-any
  data?: any // the data validated by the keyword.
}

function navigate(
  path: string[],
  annotation: AnnotatedParse,
  pathIndex = 0): AnnotatedParse
{
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    for (let i = 0; i < components.length; i += 2) {
      const key = components[i].result;
      if (key === searchKey) {
        return navigate(path, components[i + 1], pathIndex + 1);
      }
    }
    throw new Error("Internal error: searchKey not found in mapping object");
  } else if (annotation.kind === "sequence") {
    const searchKey = Number(path[pathIndex]);
    return navigate(path, annotation.components[searchKey], pathIndex + 1);
  } else {
    throw new Error(`Unexpected kind: ${annotation.kind}`);
  }
}

function localizeError(
  annotation: AnnotatedParse,
  validationErrors: ErrorObject[],
  _schema: JSONSchema // a JSON-schema object
) {
  for (const error of validationErrors) {
    const path = error.instancePath.split("/").slice(1);
    const violatingObject = navigate(path, annotation);

    // This is where we'll put our big case analysis.
    if (error.keyword === "type") {
      console.log(`Expected field ${error.instancePath} at ${violatingObject.start}--${violatingObject.end} to have type ${error.params.type}, but found ${violatingObject.kind} instead`);
    } else {
      throw new Error(`Don't know how to handle error "${error.keyword}"`);
    }
  }
}

export class YAMLSchema
{
  schema: JSONSchema; // FIXME: I haven't found typescript typings for JSON Schema
  // deno-lint-ignore no-explicit-any
  validate: any; // FIXME: find the typing for this
  
  constructor(schema: JSONSchema)
  {
    this.schema = schema;
    this.validate = ajv.compile(schema);
  }

  parseAndValidate(src: string)
  {
    const annotation = readAnnotatedYamlFromString(src);
    if (!this.validate(annotation.result)) {
      console.log("---\nValidation failed.\n");
      console.log("Schema:");
      console.log(this.schema);
      console.log("Source:");
      console.log(src);
      console.log("Result:");
      console.log(annotation.result);
      console.log("\nErrors:")

      localizeError(annotation, this.validate.errors, this.schema);
      console.log("---\n");
    };
  }
}
