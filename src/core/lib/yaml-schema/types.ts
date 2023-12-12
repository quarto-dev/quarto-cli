/*
 * types.ts
 *
 * Types for the YAML validator
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { MappedString } from "../text-types.ts";
import { ErrorLocation, TidyverseError } from "../errors-types.ts";

// https://github.com/microsoft/TypeScript/issues/1897#issuecomment-822032151
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export type Schema =
  | FalseSchema
  | TrueSchema
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | NullSchema
  | EnumSchema
  | AnySchema
  | AnyOfSchema
  | AllOfSchema
  | ArraySchema
  | ObjectSchema
  | RefSchema;

export type ConcreteSchema =
  | AnySchema
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | NullSchema
  | EnumSchema
  | AnyOfSchema
  | AllOfSchema
  | ArraySchema
  | ObjectSchema
  | RefSchema;

export type SchemaType =
  | "any"
  | "false"
  | "true"
  | "boolean"
  | "number"
  | "integer"
  | "string"
  | "null"
  | "enum"
  | "anyOf"
  | "allOf"
  | "array"
  | "object"
  | "ref";

// AnnotatedParse annotates a JSONValue with textual spans and
// components
export interface AnnotatedParse {
  start: number;
  end: number;
  result: JSONValue;
  kind: string;
  source: MappedString;
  components: AnnotatedParse[];

  errors?: { start: number; end: number; message: string }[]; // this field is only populated at the top level
}

export type InstancePath = (string | number)[];
export type SchemaPath = (string | number)[];

export interface ValidationError {
  value: AnnotatedParse;
  schema: Schema;
  message: string;
  instancePath: InstancePath;
  schemaPath: SchemaPath;
}

export interface LocalizedError {
  violatingObject: AnnotatedParse;
  schema: Schema; // this is the *localized* schema, aka the schema that violatingObject failed.
  message: string;
  instancePath: InstancePath;
  schemaPath: SchemaPath;
  source: MappedString;
  location: ErrorLocation;
  niceError: TidyverseError;
}

export interface Completion {
  display: string;
  type: "key" | "value";
  value: string;
  description: string | { $ref: string };
  // deno-lint-ignore camelcase
  suggest_on_accept: boolean;

  // `schema` stores the concrete schema that yielded the completion.
  // We need to carry it explicitly because of combinators like anyOf
  schema?: Schema;

  // the manually-generated documentation for the completion, if it exists
  documentation?: string;
}

export type FalseSchema = false; // the actual "false" value
export type TrueSchema = true; // the actual "true" value

// these are not part of JSON Schema, but they're very useful so we'll
// have them.
export interface SchemaAnnotations {
  // used to resolve schemas by reference
  "$id"?: string;

  // when true, autocompletion suggests next completion automatically
  exhaustiveCompletions?: boolean;

  // used to generate completions and HTML docs
  documentation?: SchemaDocumentation;

  // used to autogenerate error message
  description?: string;

  // schema-defined error message when schema fails
  errorMessage?: string;

  // when true, don't show on completions or documentation
  hidden?: boolean;

  // controls generation of completions
  completions?: string[]; // from the schema defn

  // stores precomputed completions at runtime
  cachedCompletions?: Completion[];

  // arbitrary tags used for a variety of reasons
  tags?: Record<string, unknown>;

  // used internally for debugging
  _internalId?: number;
}

export type SchemaDocumentation = string | {
  short?: string;
  long?: string;
};

export interface BooleanSchema extends SchemaAnnotations {
  "type": "boolean";
}

// this is not JSON schema, but makes our life easier.
export interface AnySchema extends SchemaAnnotations {
  "type": "any";
}

export interface NumberSchema extends SchemaAnnotations {
  "type": "number" | "integer";
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
}

export interface StringSchema extends SchemaAnnotations {
  "type": "string";
  pattern?: string;
  compiledPattern?: RegExp;
}

export interface NullSchema extends SchemaAnnotations {
  "type": "null";
}

export interface EnumSchema extends SchemaAnnotations {
  "type": "enum";
  "enum": JSONValue[];
}

export interface AnyOfSchema extends SchemaAnnotations {
  "type": "anyOf";
  anyOf: Schema[];
}

export interface AllOfSchema extends SchemaAnnotations {
  "type": "allOf";
  allOf: Schema[];
}

export interface ArraySchema extends SchemaAnnotations {
  "type": "array";
  items?: Schema;
  minItems?: number;
  maxItems?: number;
}

export interface ObjectSchema extends SchemaAnnotations {
  "type": "object";
  properties?: { [key: string]: Schema };
  patternProperties?: { [key: string]: Schema };
  compiledPatterns?: { [key: string]: RegExp };
  required?: string[];
  additionalProperties?: Schema;
  propertyNames?: Schema;

  closed?: boolean; // this is not part of JSON schema, but makes error reporting that much easier.
}

export interface RefSchema extends SchemaAnnotations {
  "type": "ref";
  "$ref": string;
}

export interface ValidationTraceNode {
  edge: number | string;
  errors: ValidationError[];
  children: ValidationTraceNode[];
}

export function schemaType(schema: Schema): SchemaType {
  if (schema === false) {
    return "false";
  }
  if (schema === true) {
    return "true";
  }
  return schema.type;
}

interface SchemaDispatch {
  "any"?: (x: AnySchema) => unknown;
  "false"?: (x: FalseSchema) => unknown;
  "true"?: (x: TrueSchema) => unknown;
  "boolean"?: (x: BooleanSchema) => unknown;
  "number"?: (x: NumberSchema) => unknown;
  "integer"?: (x: NumberSchema) => unknown;
  "string"?: (x: StringSchema) => unknown;
  "null"?: (x: NullSchema) => unknown;
  "enum"?: (x: EnumSchema) => unknown;
  "anyOf"?: (x: AnyOfSchema) => unknown;
  "allOf"?: (x: AllOfSchema) => unknown;
  "array"?: (x: ArraySchema) => unknown;
  "object"?: (x: ObjectSchema) => unknown;
  "ref"?: (x: RefSchema) => unknown;
}

export interface SchemaCall<T> {
  "any"?: (x: AnySchema) => T;
  "false"?: (x: FalseSchema) => T;
  "true"?: (x: TrueSchema) => T;
  "boolean"?: (x: BooleanSchema) => T;
  "number"?: (x: NumberSchema) => T;
  "integer"?: (x: NumberSchema) => T;
  "string"?: (x: StringSchema) => T;
  "null"?: (x: NullSchema) => T;
  "enum"?: (x: EnumSchema) => T;
  "anyOf"?: (x: AnyOfSchema) => T;
  "allOf"?: (x: AllOfSchema) => T;
  "array"?: (x: ArraySchema) => T;
  "object"?: (x: ObjectSchema) => T;
  "ref"?: (x: RefSchema) => T;
}

export function schemaDispatch(s: Schema, d: SchemaDispatch): void {
  const st: SchemaType = schemaType(s);
  // TypeScript can't realize that this
  // dispatch is safe (because it can't associate the return of st with s).
  // TODO https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
  //
  if (d[st]) {
    // deno-lint-ignore no-explicit-any
    (d[st]! as ((x: any) => unknown))(s as any);
  }
}

export function schemaCall<T>(
  s: Schema,
  d: SchemaCall<T>,
  other?: (s: Schema) => T,
): T {
  const st: SchemaType = schemaType(s);
  // TypeScript can't realize that this
  // dispatch is safe (because it can't associate the return of st with s).
  // TODO https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
  // TODO https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
  //
  if (d[st]) {
    // deno-lint-ignore no-explicit-any
    return (d[st]! as ((x: any) => T))(s as any);
  }
  if (other) {
    return other(s);
  }
  // TODO this should be InternalError but we don't want
  // to introduce a dependency on error.ts
  throw new Error(`Internal Error: Dispatch failed for type ${st}`);
}

// note that we intentionally never use d.long, since that's
// reserved for the webpage documentation stuff.
export function schemaDocString(d: SchemaDocumentation): string {
  if (typeof d === "string") {
    return d;
  }
  if (d.short) {
    return d.short;
  }
  return "";
}

export function schemaDescription(schema: Schema): string {
  if (schema === true) {
    return `be anything`;
  } else if (schema === false) {
    return `be no possible value`;
    // this is clunky phrasing because
    // of `be ...` requirement for
    // descriptions
  } else {
    return schema.description || `be ${schemaType(schema)}`;
  }
}
