/*
* validator.ts
*
* main validator class.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  AllOfSchema,
  AnnotatedParse,
  AnyOfSchema,
  ArraySchema,
  BooleanSchema,
  Completion,
  EnumSchema,
  FalseSchema,
  JSONValue,
  LocalizedError,
  NullSchema,
  NumberSchema,
  ObjectSchema,
  RefSchema,
  Schema,
  schemaCall,
  schemaType,
  StringSchema,
  TrueSchema,
  ValidationError,
  ValidationTraceNode,
} from "./types.ts";

import { resolveSchema } from "../schema-utils.ts";

import { MappedString } from "../../mapped-text.ts";

import { ErrorObject } from "../ajv-error.ts";

////////////////////////////////////////////////////////////////////////////////

class ValidationContext {
  instancePath: (number | string)[];
  root: ValidationTraceNode;
  nodeStack: ValidationTraceNode[];

  currentNode: ValidationTraceNode;

  constructor() {
    this.instancePath = [];
    this.currentNode = { edge: "#", errors: [], children: [] };
    this.nodeStack = [this.currentNode];
    this.root = this.currentNode;
  }

  error(value: AnnotatedParse, schema: Schema, message: string) {
    this.currentNode.errors.push({
      value,
      schema,
      message,
      instancePath: this.instancePath.slice(),
    });
  }

  pushSchema(schemaPath: number | string) {
    const newNode = {
      edge: schemaPath,
      errors: [],
      children: [],
    };
    this.currentNode.children.push(newNode);
    this.currentNode = newNode;
    this.nodeStack.push(newNode);
  }
  popSchema(success: boolean) {
    this.nodeStack.pop();
    this.currentNode = this.nodeStack[this.nodeStack.length - 1];
    if (success) {
      this.currentNode.children.pop();
    }
    return success;
  }

  pushInstance(instance: number | string) {
    this.instancePath.push(instance);
  }
  popInstance() {
    this.instancePath.pop();
  }

  withSchemaPath(schemaPath: number | string, chunk: () => boolean): boolean {
    this.pushSchema(schemaPath);
    return this.popSchema(chunk());
  }

  validate(
    schema: Schema,
    source: MappedString,
    value: AnnotatedParse,
  ): LocalizedError[] {
    if (validateGeneric(value, schema, this)) {
      // validation passed, don't collect errors
      return [];
    }
    return this.pruneErrors(schema, source, value);
  }

  pruneErrors(
    schema: Schema,
    source: MappedString,
    value: AnnotatedParse,
  ): LocalizedError[] {
    debugger;
    return [];
  }
}

function validateGeneric(
  value: AnnotatedParse,
  s: Schema,
  context: ValidationContext,
): boolean {
  s = resolveSchema(s);
  const st = schemaType(s);
  return context.withSchemaPath(st, () =>
    schemaCall(s, {
      "false": (schema: false) => {
        context.error(value, schema, "false");
        return false;
      },
      "true": (_: true) => true,
      "boolean": (schema: BooleanSchema) =>
        validateBoolean(value, schema, context),
      "number": (schema: NumberSchema) =>
        validateNumber(value, schema, context),
      "string": (schema: StringSchema) =>
        validateString(value, schema, context),
      "null": ((schema: NullSchema) => validateNull(value, schema, context)),
      "enum": ((schema: EnumSchema) => validateEnum(value, schema, context)),
      "anyOf": (schema: AnyOfSchema) => validateAnyOf(value, schema, context),
      "allOf": (schema: AllOfSchema) => validateAllOf(value, schema, context),
      "array": (schema: ArraySchema) => validateArray(value, schema, context),
      "object": (schema: ObjectSchema) =>
        validateObject(value, schema, context),
      "ref": (schema: RefSchema) =>
        validateGeneric(value, resolveSchema(schema), context),
    }));
}

function typeIsValid(
  value: AnnotatedParse,
  schema: Schema,
  context: ValidationContext,
  valid: boolean,
): boolean {
  if (!valid) {
    return context.withSchemaPath(
      "type",
      () => {
        context.error(value, schema, "type mismatch");
        return false;
      },
    );
  }
  return valid;
}

function validateBoolean(
  value: AnnotatedParse,
  schema: BooleanSchema,
  context: ValidationContext,
): boolean {
  return typeIsValid(value, schema, context, typeof value.result === "boolean");
}

function validateNumber(
  value: AnnotatedParse,
  schema: NumberSchema,
  context: ValidationContext,
) {
  if (!typeIsValid(value, schema, context, typeof value.result === "number")) {
    return false;
  }
  // FINISHME add numeric validation
  return true;
}

function validateString(
  value: AnnotatedParse,
  schema: StringSchema,
  context: ValidationContext,
) {
  if (!typeIsValid(value, schema, context, typeof value.result === "string")) {
    return false;
  }
  if (schema.pattern !== undefined) {
    if (schema.compiledPattern === undefined) {
      schema.compiledPattern = new RegExp(schema.pattern);
    }

    // typescript doesn't see the typeIsValid check above.
    if (!(value.result as string).match(schema.compiledPattern)) {
      return context.withSchemaPath(
        "pattern",
        () => {
          context.error(value, schema, `value doesn't match pattern`);
          return false;
        },
      );
    }
  }
  return true;
}

function validateNull(
  value: AnnotatedParse,
  schema: NullSchema,
  context: ValidationContext,
) {
  if (!typeIsValid(value, schema, context, value.result === null)) {
    return false;
  }
  return true;
}

function validateEnum(
  value: AnnotatedParse,
  schema: EnumSchema,
  context: ValidationContext,
) {
  // FIXME do we do deepEquals here? that's the correct thing
  // but probably won't come up for quarto, and it's slow and adds a dependency
  for (const enumValue of schema["enum"]) {
    if (enumValue === value.result) {
      return true;
    }
  }
  // didn't pass validation
  context.error(value, schema, `must match one of the values`);
  return false;
}

function validateAnyOf(
  value: AnnotatedParse,
  schema: AnyOfSchema,
  context: ValidationContext,
) {
  let passingSchemas = 0;
  for (let i = 0; i < schema.anyOf.length; ++i) {
    const subSchema = schema.anyOf[i];
    context.withSchemaPath(i, () => {
      if (validateGeneric(value, subSchema, context)) {
        passingSchemas++;
        return true;
      }
      return false;
    });
  }
  return passingSchemas > 0;
}

function validateAllOf(
  value: AnnotatedParse,
  schema: AllOfSchema,
  context: ValidationContext,
) {
  let passingSchemas = 0;
  for (let i = 0; i < schema.allOf.length; ++i) {
    const subSchema = schema.allOf[i];
    context.withSchemaPath(i, () => {
      if (validateGeneric(value, subSchema, context)) {
        passingSchemas++;
        return true;
      }
      return false;
    });
  }
  return passingSchemas === schema.allOf.length;
}

function validateArray(
  value: AnnotatedParse,
  schema: ArraySchema,
  context: ValidationContext,
) {
  let result = true;
  if (!typeIsValid(value, schema, context, Array.isArray(value.result))) {
    return false;
  }
  const length = (value.result as JSONValue[]).length;
  if (
    schema.minItems !== undefined &&
    length < schema.minItems
  ) {
    context.withSchemaPath(
      "minItems",
      () => {
        context.error(
          value,
          schema,
          `array should have at least ${schema.minItems} items but has ${length} items instead`,
        );
        return false;
      },
    );
    result = false;
  }
  if (schema.maxItems !== undefined && length > schema.maxItems) {
    context.withSchemaPath(
      "maxItems",
      () => {
        context.error(
          value,
          schema,
          `array should have at most ${schema.maxItems} items but has ${length} items instead`,
        );
        return false;
      },
    );
    result = false;
  }
  if (schema.items) {
    result = context.withSchemaPath("items", () => {
      let result = true;
      for (let i = 0; i < value.components.length; ++i) {
        context.pushInstance(i);
        result = validateGeneric(value.components[i], schema.items!, context) &&
          result;
        context.popInstance();
      }
      return result;
    }) && result;
  }
  return result;
}

function validateObject(
  value: AnnotatedParse,
  schema: ObjectSchema,
  context: ValidationContext,
) {
  const isObject = (typeof value.result === "object") &&
    !Array.isArray(value.result) && (value.result !== null);
  if (!typeIsValid(value, schema, context, isObject)) {
    return false;
  }
  let result = true;
  const ownProperties: Set<string> = new Set(
    Object.getOwnPropertyNames(value.result),
  );

  const objResult = value.result as { [key: string]: JSONValue };

  const locate = (
    key: string,
    keyOrValue: "key" | "value" = "value",
  ): AnnotatedParse => {
    for (let i = 0; i < value.components.length; i += 2) {
      if (value.components[i].result === key) {
        if (keyOrValue === "value") {
          return value.components[i + 1];
        } else {
          return value.components[i];
        }
      }
    }
    throw new Error(`Internal Error, couldn't locate key ${key}`);
  };
  const inspectedProps: Set<string> = new Set();
  if (schema.properties !== undefined) {
    result = context.withSchemaPath("properties", () => {
      let result = true;
      for (const [key, subSchema] of Object.entries(schema.properties!)) {
        if (ownProperties.has(key)) {
          context.pushInstance(key);
          result = context.withSchemaPath(
            key,
            () => validateGeneric(locate(key), subSchema, context),
          ) && result;
          context.popInstance();
        } else {
          inspectedProps.add(key);
        }
      }
      return result;
    }) && result;
  }
  if (schema.patternProperties !== undefined) {
    result = context.withSchemaPath("patternProperties", () => {
      let result = true;
      for (
        const [key, subSchema] of Object.entries(schema.patternProperties!)
      ) {
        if (schema.compiledPatterns === undefined) {
          schema.compiledPatterns = {};
        }
        if (schema.compiledPatterns[key] === undefined) {
          schema.compiledPatterns[key] = new RegExp(key);
        }
        const regexp = schema.compiledPatterns[key];

        for (
          const [objectKey, val] of Object.entries(objResult)
        ) {
          if (ownProperties.has(key)) {
            context.pushInstance(objectKey);
            result = context.withSchemaPath(
              key,
              () => validateGeneric(locate(key), subSchema, context),
            ) && result;
            context.popInstance();
          } else {
            inspectedProps.add(key);
          }
        }
      }
      return result;
    }) && result;
  }
  if (schema.additionalProperties !== undefined) {
    result = context.withSchemaPath("additionalProperties", () => {
      return Object.keys(objResult)
        .filter((objectKey) => !inspectedProps.has(objectKey))
        .every((objectKey) =>
          validateGeneric(
            locate(objectKey),
            schema.additionalProperties!,
            context,
          )
        );
    }) && result;
  }
  if (schema.propertyNames !== undefined) {
    result = context.withSchemaPath("propertyNames", () => {
      return Array.from(ownProperties)
        .every((key) =>
          validateGeneric(locate(key, "key"), schema.propertyNames!, context)
        );
    }) && result;
  }
  if (schema.required !== undefined) {
    result = context.withSchemaPath("propertyNames", () => {
      let result = true;
      for (const reqKey of schema.required!) {
        if (!ownProperties.has(reqKey)) {
          context.error(
            value,
            schema,
            `object is missing required property ${reqKey}`,
          );
          result = false;
        }
      }
      return result;
    }) && result;
  }
  return result;
}

export function validate(
  value: AnnotatedParse,
  schema: Schema,
  source: MappedString,
): LocalizedError[] {
  const context = new ValidationContext();

  return context.validate(schema, source, value);
}
