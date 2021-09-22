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
import { AnnotatedParse, readAnnotatedYamlFromString, readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { Range } from "../ranged-text.ts";
import { MappedString, mappedLineNumbers } from "../mapped-text.ts";

const ajv = new Ajv({ allErrors: true });

////////////////////////////////////////////////////////////////////////////////

// deno-lint-ignore no-explicit-any
export type JSONSchema = any;

// NB we change the params field from the URL above to be able to inspect the
// value
export interface ErrorObject {
  keyword: string; // validation keyword.
  instancePath: string; // JSON Pointer to the location in the data instance (e.g., `"/prop/1/subProp"`).
  schemaPath: string; // JSON Pointer to the location of the failing keyword in the schema
// deno-lint-ignore no-explicit-any
  params: any; // type is defined by keyword value, see below
  // params property is the object with the additional information about error
  // it can be used to generate error messages
  // (e.g., using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n) package).
  // See below for parameters set by all keywords.
  propertyName?: string; // set for errors in `propertyNames` keyword schema.
                         // `instancePath` still points to the object in this case.
  message?: string; // the error message (can be excluded with option `messages: false`).
  // Options below are added with `verbose` option:
  // deno-lint-ignore no-explicit-any
  schema?: any; // the value of the failing keyword in the schema.
  parentSchema?: object; // the schema containing the keyword.
  // deno-lint-ignore no-explicit-any
  data?: any // the data validated by the keyword.
}

export interface LocalizedError {
  source: MappedString;
  violatingObject: AnnotatedParse;
  instancePath: string;
  message: string;
};

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

function localizeErrors(
  annotation: AnnotatedParse,
  validationErrors: ErrorObject[],
  source: MappedString,
  _schema: JSONSchema // a JSON-schema object
) {
  const result: LocalizedError[] = [];
  const locF = mappedLineNumbers(source);
  
  for (const error of validationErrors) {
    const instancePath = error.instancePath;
    const path = error.instancePath.split("/").slice(1);
    const violatingObject = navigate(path, annotation);
    let message = "";

    // this is going to be a big case analysis of possible validation errors.
    if (error.keyword === "type") {
      const start = locF(violatingObject.start);
      const end = locF(violatingObject.end);
      
      message = `Expected field ${instancePath} (starting at ${start.line + 1}:${start.column + 1} and ending at ${end.line + 1}:${end.column + 1}) to have type ${error.params.type}, but found ${violatingObject.kind} instead`;
    } else {
      console.log({error});
      console.log(`Internal error! Don't know how to handle error "${error.keyword}"`);
      // throw new Error(`Don't know how to handle error "${error.keyword}"`);
      continue;
    }
    
    result.push({
      instancePath,
      violatingObject,
      message,
      source
    });
  }
  return result;
}

// FIXME YAMLSchema is not reentrant because ajv isn't (!)
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

  parseAndValidate(src: MappedString)
  {
    const annotation = readAnnotatedYamlFromMappedString(src);
    let errors: LocalizedError[] = [];
    if (!this.validate(annotation.result)) {
      errors = localizeErrors(
        annotation, this.validate.errors,
        src, this.schema);
    }
    return {
      result: annotation.result,
      errors
    };
  }
  
}
