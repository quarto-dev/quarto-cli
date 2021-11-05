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
import { formatLineRange, lines, indexToRowCol } from "./text.ts";
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
  messageNoLocation?: string;
  start?: {
    line: number,
    column: number
  },
  end?: {
    line: number,
    column: number,
  },
  error?: any; // upstream error
};

function navigate(
  path: string[],
  annotation: AnnotatedParse,
  returnKey = false, // if true, then return the *key* entry as the final result rather than the *value* entry.
  pathIndex = 0): AnnotatedParse
{
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "mapping" || annotation.kind === "block_mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    for (let i = 0; i < components.length; i += 2) {
      const key = components[i].result;
      if (key === searchKey) {
        if (returnKey && pathIndex === path.length - 1) {
          return navigate(path, components[i], returnKey, pathIndex + 1);
        } else {
          return navigate(path, components[i + 1], returnKey, pathIndex + 1);
        }
      }
    }
    throw new Error("Internal error: searchKey not found in mapping object");
  } else if (annotation.kind === "sequence" || annotation.kind === "block_sequence") {
    const searchKey = Number(path[pathIndex]);
    return navigate(path, annotation.components[searchKey], returnKey, pathIndex + 1);
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
  } else if (pathVal === "items") {
    const subSchema = schema.items;
    return navigateSchema(path, subSchema, pathIndex + 1);
  } else {
    console.log({path});
    throw new Error("Internal error: Failed to navigate schema path");
  }
}

function isProperPrefix(a: string, b:string)
{
  return (b.length > a.length) && b.substring(0, a.length) === a;
}

/*
 * This attempts to prune the large number of errors reported by avj.
 * 
 * We apply two general heuristics:
 *
 * 1. if there are errors in two instance paths, and one error is in a
 *    prefix of another error, we only report the innermost error (the
 *    principle here is that inner instances are smaller, and it's
 *    easier to wrap your head around fixing an error in a smaller
 *    instance than it is on a large one, and maybe fixing the smaller
 *    error also fixes the larger error.)
 *
 * 2. For errors in the _same_ instance path, we always choose at most
 *    one error to display.
 */
function localizeAndPruneErrors(
  annotation: AnnotatedParse,
  validationErrors: ErrorObject[],
  source: MappedString,
  schema: JSONSchema
) {
  const result: LocalizedError[] = [];
  
  // since the annotated object returns mapped values, we need to call them
  // on the coordinate system of the original string (since they're mapped)
  // as a result, here we use indexToRowCol instead of mappedIndexToRowCol
  const locF = indexToRowCol(source.originalString);

  // group errors per instance in which they appear
  interface NamedErrorList {
    instancePath: string;
    errors: ErrorObject[];
  }
  const errorsPerInstanceMap: Record<string, NamedErrorList> = {};
  let errorsPerInstanceList: NamedErrorList[] = [];

  const recordErrorInMaps = (instancePath: string, error: ErrorObject) => {
    if (errorsPerInstanceMap[instancePath] === undefined) {
      // NB the deliberate sharing of `lst` here
      const errors: ErrorObject[] = [];
      const namedError: NamedErrorList = {
        instancePath,
        errors,
      };
      errorsPerInstanceMap[instancePath] = namedError;
      errorsPerInstanceList.push(namedError);
    }
    errorsPerInstanceMap[instancePath].errors.push(error);
  }
  
  for (let error of validationErrors) {
    let { instancePath } = error;
    
    recordErrorInMaps(instancePath, error);
    
    // transform additionalProperties errors into a custom error message
    // only about the inner invalid property.
    if (error.keyword === "additionalProperties") {
      instancePath = `${instancePath}/${error.params.additionalProperty}`;
      recordErrorInMaps(instancePath, {
        ...error,
        instancePath,
        keyword: "_custom_invalidProperty",
        message: `property ${error.params.additionalProperty} not allowed in object`,
        params: {
          ...error.params,
          originalError: error
        },
        schemaPath: error.schemaPath.slice(0, -21), // drop "/additionalProperties",
      });
    }
  }

  // keep only the errors with _instancePaths_ that are not proper prefixes of others
  // keep only "innermost errors": the most _specific_
  errorsPerInstanceList = errorsPerInstanceList.filter(
    ({ instancePath: pathA }) => errorsPerInstanceList.filter(
      ({ instancePath: pathB }) => isProperPrefix(pathA, pathB)).length === 0);

  for (let { instancePath, errors: allErrors } of errorsPerInstanceList) {
    const path = instancePath.split("/").slice(1);

    // now, we keep only the errors with _schemaPaths_ that are the most _general_
    // ie, we filter out those that have other proper prefixes

    debugger;

    const errors = allErrors.filter(({ schemaPath: pathA }) =>
      !(allErrors.filter(({ schemaPath: pathB }) => isProperPrefix(pathB, pathA)).length > 0));
    
    for (const error of errors) {
      const returnKey = error.keyword === "_custom_invalidProperty";
      const violatingObject = navigate(path, annotation, returnKey);
      const schemaPath = error.schemaPath.split("/").slice(1);
      const innerSchema = navigateSchema(schemaPath, schema);

      const start = locF(violatingObject.start);
      const end = locF(violatingObject.end);

      const locStr = (start.line === end.line ?
        `(line ${start.line + 1}, columns ${start.column + 1}--${end.column + 1})`
        : `(line ${start.line + 1}, column ${start.column + 1} through line ${end.line + 1}, column ${end.column + 1})`);

      let messageNoLocation;
      // in the case of customized errors, use message we prepared earlier
      if (error.keyword.startsWith("_custom_")) {
        messageNoLocation = error.message;
      } else {
        messageNoLocation = `Field ${instancePath} must ${innerSchema.description}`;
      }
      const message = `${locStr}: ${messageNoLocation}`;
      
      result.push({
        instancePath,
        violatingObject,
        message,
        messageNoLocation,
        source,
        start,
        end,
        error // we include the full error to allow downstream fine-tuning
      });
    }
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

