/*
* yaml-schema.ts
*
* A class to manage YAML Schema validation and associated tasks like
* error localization
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Range } from "../ranged-text.ts";
import { MappedString, mappedIndexToRowCol } from "./mapped-text.ts";
import { formatLineRange, lines } from "./text.ts";
import { normalizeSchema } from "./schema.ts";

////////////////////////////////////////////////////////////////////////////////

export interface AnnotatedParse
{
  start: number,
  end: number,
  result: any,
  kind: string,
  components: AnnotatedParse[]
};

let ajv: any = undefined;

/* we use a minimal dependency-injection setup here to decouple this
   library from the Ajv dependency. This allows us core-lib not to
   depend directly on Ajv, which in turn lets us use the UMD version
   of Ajv in the Javascript runtime.

   Ideally, we'd do the same for the YAML parsers, which are different
   in deno and in the browser. At some point, we might want to shim over
   these two parsers and inject a common dependency into yaml-schema.

   Right now, we do this indirectly by expecting an AnnotatedParse as
   input to the validation class. It gets the job done but isn't very
   clean.
*/
export function setupAjv(_ajv: any)
{
  debugger;
  ajv = _ajv;
}

// deno-lint-ignore no-explicit-any
export type JSONSchema = any;

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
    throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}

function navigateSchema(
  path: string[],
  schema: JSONSchema,
  pathIndex = 0): JSONSchema
{
  if (pathIndex >= path.length - 1) {
    return schema;
  }
  const pathVal = path[pathIndex];
  if (pathVal === "properties") {
    const key = path[pathIndex + 1];
    const subSchema = schema.properties[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "anyOf") {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.anyOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "oneOf") {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.oneOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else {
    console.log({path});
    throw new Error("Internal error: Failed to navigate schema path");
  }
}

function isProperPrefix(a: string, b:string)
{
  return (b.length > a.length) && b.substring(0, a.length) === a;
}

function localizeAndPruneErrors(
  annotation: AnnotatedParse,
  validationErrors: ErrorObject[],
  source: MappedString,
  schema: JSONSchema
) {
  const result: LocalizedError[] = [];
  const locF = mappedIndexToRowCol(source);

  for (const error of validationErrors) {
    const instancePath = error.instancePath;
    
    const path = error.instancePath.split("/").slice(1);

    // FIXME these are O(n^2) checks; maybe we can avoid the
    // performance trouble by building the tree of instancePaths and
    // the associated errors?

    // we skip anyOf and oneOf errors that have other more localized errors inside them
    if (["oneOf", "anyOf"].indexOf(error.keyword) !== -1 &&
      validationErrors.filter(
        otherError => isProperPrefix(
          instancePath, otherError.instancePath)).length > 0) {
      continue;
    }

    // we skip enums and types if there is a broader oneOf or anyOf which
    // matches our instancePath
    if (["enum", "type"].indexOf(error.keyword) !== -1 &&
      validationErrors.some(
        (otherError => instancePath === otherError.instancePath &&
          ["oneOf", "anyOf"].indexOf(otherError.keyword) !== -1))) {
      continue;
    }
    const schemaPath = error.schemaPath.split("/").slice(1);
    const violatingObject = navigate(path, annotation);
    const innerSchema = navigateSchema(schemaPath, schema);
    let message = "";

    const start = locF(violatingObject.start);
    const end = locF(violatingObject.end);
    
    const locStr = (start.line === end.line ?
      `(line ${start.line + 1}, columns ${start.column + 1}--${end.column + 1})`
      : `(line ${start.line + 1}, column ${start.column + 1} through line ${end.line + 1}, column ${end.column + 1})`);

    message = `${locStr}: Expected field ${instancePath} to ${innerSchema.description}`;
    
    result.push({
      instancePath,
      violatingObject,
      message,
      source
    });
  }
  result.sort((a, b) => a.violatingObject.start - b.violatingObject.start);
  return result;
}

interface ValidatedParseResult
{
  result: any,
  errors: LocalizedError[]
};

// FIXME YAMLSchema is not reentrant because ajv isn't (!)
export class YAMLSchema
{
  schema: JSONSchema; // FIXME: I haven't found typescript typings for JSON Schema
  // deno-lint-ignore no-explicit-any
  validate: any; // FIXME: find the typing for this
  
  constructor(schema: JSONSchema)
  {
    this.schema = schema;
    this.validate = ajv.compile(normalizeSchema(schema));
  }

  // FIXME this is the old method before YAMLSchema was used in both IDE and Deno
  // envs
  //
  // parseAndValidate(src: MappedString)
  // {
  //   const annotation = readAnnotatedYamlFromMappedString(src);
  //   return this.validateParse(src, annotation);
  // }

  validateParse(
    src: MappedString,
    annotation: AnnotatedParse
  )
  {
    let errors: LocalizedError[] = [];
    if (!this.validate(annotation.result)) {
      errors = localizeAndPruneErrors(
        annotation, this.validate.errors,
        src, this.schema);
      return {
        result: annotation.result,
        errors
      };
    } else {
      return {
        result: annotation.result,
        errors: []
      };
    }
  }
  

  reportErrorsInSource(
    result: ValidatedParseResult,
    src: MappedString,
    message: string,
    error: (a: string) => any
  )
  {
    if (result.errors.length) {
      const locF = mappedIndexToRowCol(src);
      const nLines = lines(src.originalString).length;
      error(message);
      for (const err of result.errors) {
        console.log(err.message);
        // attempt to trim whitespace from error report
        let startO = err.violatingObject.start;
        let endO = err.violatingObject.end;
        while (
          (src.mapClosest(startO)! < src.originalString.length - 1) &&
            src.originalString[src.mapClosest(startO)!].match(/\s/)
        ) {
          startO++;
        }
        while (
          (src.mapClosest(endO)! > src.mapClosest(startO)!) &&
            src.originalString[src.mapClosest(endO)!].match(/\s/)
        ) {
          endO--;
        }
        // FIXME figure out why we're off by one at the end of subM here.
        // console.log({
        //   startO, endO, originalString: src.originalString, char: src.originalString[startO],
        //   sub: src.originalString.substring(startO, endO),
        //   subM: src.originalString.substring(src.mapClosest(startO)!, src.mapClosest(endO)!)
        // });
        const start = locF(startO);
        const end = locF(endO);
        const {
          prefixWidth,
          lines
        } = formatLineRange(
          src.originalString,
          Math.max(0, start.line - 1),
          Math.min(end.line + 1, nLines - 1));
        for (const { lineNumber, content, rawLine } of lines) {
          console.log(content);
          if (lineNumber >= start.line && lineNumber <= end.line) {
            const startColumn = (lineNumber > start.line ? 0 : start.column);
            const endColumn = (lineNumber < end.line ? rawLine.length : end.column);
            console.log(" ".repeat(prefixWidth + startColumn) + "^".repeat(endColumn - startColumn + 1));
          }
        }
      }
    }
    return result;
  }

  // FIXME this is the old method with a single parse API
  //
  // parseAndValidateWithErrors(
  //   src: MappedString,
  //   message: string
  // )
  // {
  //   const result = this.parseAndValidate(src);
  //   this.reportErrorsInSource(result, src, message);
  //   return result;
  // }

  validateParseWithErrors(
    src: MappedString,
    annotation: AnnotatedParse,
    message: string,
    error: (a: string) => any
  )
  {
    const result = this.validateParse(src, annotation);
    this.reportErrorsInSource(result, src, message, error);
    return result;
  }
}

