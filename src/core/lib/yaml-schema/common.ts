/*
 * common.ts
 *
 * Common JSON Schema objects that make up a schema combinator library.
 *
 * These are not strictly JSON Schemas (they have extra fields for
 * auto-completions, etc) but core/lib/schema.ts includes a
 * `normalizeSchema()` call that takes a schema produced here and
 * returns a valid JSON Schema object.
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { InternalError, UnreachableError } from "../error.ts";
import { CaseConvention, resolveCaseConventionRegex } from "../text.ts";

import {
  AllOfSchema,
  AnyOfSchema,
  AnySchema,
  ArraySchema,
  ConcreteSchema,
  EnumSchema,
  JSONValue,
  NumberSchema,
  ObjectSchema,
  RefSchema,
  Schema,
  schemaDescription,
  StringSchema,
} from "./types.ts";

////////////////////////////////////////////////////////////////////////////////

let globalInternalIdCounter = 0;
function internalId(): {
  _internalId: number;
} {
  return {
    _internalId: ++globalInternalIdCounter,
  };
}

export function tagSchema<T extends ConcreteSchema>(
  schema: T,
  // deno-lint-ignore no-explicit-any
  tags: Record<string, any>,
): T {
  return {
    ...schema,
    tags: {
      ...(schema.tags || {}),
      ...tags,
    },
  };
}

export function numericSchema(obj: {
  "type": "integer" | "number";
  "minimum"?: number;
  "maximum"?: number;
  "exclusiveMinimum"?: number;
  "exclusiveMaximum"?: number;
  "multipleOf"?: number;
  "description"?: string;
}): NumberSchema {
  return Object.assign({
    ...internalId(),
    description: "be a number",
  }, obj);
}

export function anySchema(description?: string): AnySchema {
  return {
    ...internalId(),
    description,
    "type": "any",
  };
}

export function enumSchema(...args: JSONValue[]): EnumSchema {
  if (args.length === 0) {
    throw new InternalError("Empty enum schema not supported.");
  }
  return {
    ...internalId(),
    "type": "enum",
    "enum": args,
    "description": args.length > 1
      ? `be one of: ${args.map((x) => "`" + x + "`").join(", ")}`
      : `be '${args[0]}'`,
    "completions": args.map(String),
    "exhaustiveCompletions": true,
  };
}

export function regexSchema(arg: string, description?: string): StringSchema {
  const result: Schema = {
    ...internalId(),
    "type": "string",
    "pattern": arg,
  };
  if (description) {
    result.description = description;
  } else {
    result.description = `be a string that satisfies regex "${arg}"`;
  }
  return result;
}

export function anyOfSchema(...args: Schema[]): AnyOfSchema {
  return {
    ...internalId(),
    "type": "anyOf",
    "anyOf": args,
    "description": `be at least one of: ${
      args.map((x) => schemaDescription(x).slice(3)).join(", ")
    }`,
  };
}

export function allOfSchema(...args: Schema[]): AllOfSchema {
  return {
    ...internalId(),
    "type": "allOf",
    "allOf": args,
    "description": `be all of: ${
      args.map((x) => schemaDescription(x).slice(3)).join(", ")
    }`,
  };
}

// TODO add dynamic check for requiredProps being a subset of the
// keys in properties
export function objectSchema(params: {
  properties?: { [k: string]: Schema };
  patternProperties?: { [k: string]: Schema };
  propertyNames?: Schema;
  required?: string[];
  exhaustive?: boolean;
  additionalProperties?: Schema;
  description?: string;
  baseSchema?: ObjectSchema | ObjectSchema[];
  completions?: { [k: string]: unknown }; // FIXME the value should be string | that completions object we can create.
  namingConvention?: CaseConvention[] | "ignore";
  closed?: boolean;
} = {}): ObjectSchema {
  let {
    properties,
    patternProperties,
    required,
    additionalProperties,
    description,
    baseSchema,
    exhaustive,
    completions: completionsParam,
    namingConvention,
    propertyNames: propertyNamesSchema,
    closed,
  } = params;

  required = required || [];
  properties = properties || {};
  patternProperties = patternProperties || {};
  // deno-lint-ignore no-explicit-any
  let tags: Record<string, any> = {};
  let tagsAreSet = false;
  let propertyNames: Schema | undefined = propertyNamesSchema;

  if (completionsParam) {
    tags["completions"] = completionsParam;
    tagsAreSet = true;
  }

  const createCaseConventionSchema = (
    props: { [k: string]: Schema },
  ): StringSchema | undefined => {
    // 2023-01-17: we no longer support propertyNames _and_ case convention detection.
    // if propertyNames are defined, we don't add case convention detection.
    // this simplifies the logic and makes schema debugging easier.
    if (namingConvention === "ignore") {
      return undefined;
    }
    const objectKeys = Object.getOwnPropertyNames(
      props,
    );
    const { pattern, list } = resolveCaseConventionRegex(
      objectKeys,
      namingConvention,
    );
    if (pattern === undefined) {
      return undefined;
    }
    if (propertyNames !== undefined) {
      console.error(
        "Warning: propertyNames and case convention detection are mutually exclusive.",
      );
      console.error(
        "Add `namingConvention: 'ignore'` to your schema definition to remove this warning.",
      );
      return undefined;
    }
    const tags = {
      "case-convention": list,
      "error-importance": -5,
      "case-detection": true,
    };
    return {
      errorMessage: "property ${value} does not match case convention " +
        `${objectKeys.join(",")}`,
      "type": "string",
      pattern,
      tags,
    };
  };

  const hasDescription = description !== undefined;
  description = description || "be an object";
  let result: ObjectSchema | undefined = undefined;

  if (baseSchema) {
    if (!Array.isArray(baseSchema)) {
      baseSchema = [baseSchema];
    }
    if (baseSchema.some((s) => s.type !== "object")) {
      throw new InternalError("Attempted to extend a non-object schema");
    }
    if (baseSchema.length <= 0) {
      throw new InternalError("base schema cannot be empty list");
    }
    // deno-lint-ignore no-explicit-any
    let temp: any = {
      ...internalId(),
    };
    for (const base of baseSchema) {
      temp = Object.assign(temp, base);
    }
    result = temp;
    if (result === undefined) {
      throw new UnreachableError();
    }
    // remove $id from base schema to avoid names from getting multiplied
    if (result.$id) {
      delete result.$id;
    }
    for (const base of baseSchema) {
      if (base.exhaustiveCompletions) {
        result.exhaustiveCompletions = true;
      }
    }

    if (hasDescription) {
      result.description = description;
    }

    const m: Map<string, [Schema, string][]> = new Map();
    for (const base of baseSchema) {
      for (const [k, v] of Object.entries(base.properties || {})) {
        if (!m.has(k)) {
          m.set(k, []);
        }
        // deno-lint-ignore no-explicit-any
        m.get(k)!.push([v, (base as any).$id]);
      }
    }
    const errorMsgs = new Set<string>();
    for (const [k, l] of m) {
      if (l.length > 1) {
        errorMsgs.add(
          `Internal Error: base schemas ${
            l
              .map((x) => x[1])
              .join(", ")
          } share property ${k}.`,
        );
      }
    }
    if (errorMsgs.size > 0) {
      console.error(
        [...errorMsgs].toSorted((a, b) => a.localeCompare(b)).join("\n"),
      );
      console.error("This is a bug in quarto's schemas.");
      console.error(
        "Note that we don't throw in order to allow build-js to finish, but the generated schemas will be invalid.",
      );
    }

    result.properties = Object.assign(
      {},
      ...(baseSchema.map((s) => s.properties)),
      properties,
    );
    result.patternProperties = Object.assign(
      {},
      ...(baseSchema.map((s) => s.patternProperties).filter((s) =>
        s !== undefined
      )),
      patternProperties,
    );

    result.required = [
      ...baseSchema.map((s) => s.required || []),
      required || [],
    ].flat();
    if (result.required && result.required.length === 0) {
      result.required = undefined;
    }

    // TODO Review. This is likely to be confusing, but I think
    // it's the correct semantics for subclassing
    const additionalPropArray = baseSchema.map((s) => s.additionalProperties)
      .filter((s) => s !== undefined) as Schema[];
    if (additionalProperties) {
      additionalPropArray.push(additionalProperties);
    }
    if (additionalPropArray.length) {
      result.additionalProperties = allOfSchema(...additionalPropArray);
    }

    // propertyNames === undefined means that the behavior should be
    // identical to `propertyNames: true`.
    //
    // The semantics of extending schema A through B should be that the resulting
    // propertyNames behaves as anyOf(A.propertyNames, B.propertyNames)
    //
    // If any of those is undefined, then we get anyOf(true, .) or anyOf(., true),
    // which is equivalent to true, which is equivalent to undefined (and so
    // we don't need to set the property)
    //
    // as a result, we only set propertyNames on the extended schema if both
    // all propertyNames fields are defined.

    // if we subclass from something with patternProperties that came from case convention
    // detection, ignore that.

    const propNamesArray = baseSchema.map((s) => s.propertyNames)
      .filter((s) => {
        if (typeof s !== "object") return true;
        if (s.tags === undefined) return true;
        if (s.tags["case-detection"] === true) {
          return false;
        }
        return true;
      })
      .filter((s) => s !== undefined) as Schema[];
    if (propNamesArray.length === 1) {
      result.propertyNames = propNamesArray[0];
    } else if (propNamesArray.length > 1) {
      result.propertyNames = anyOfSchema(...propNamesArray);
    } else {
      delete result.propertyNames;
    }

    // if either of schema or base schema is closed, the derived schema is also closed.
    result.closed = closed || baseSchema.some((s) => s.closed);
  } else {
    const caseConventionSchema = createCaseConventionSchema(properties);
    if (caseConventionSchema !== undefined) {
      propertyNames = caseConventionSchema;
      tags = {
        ...tags,
        ...caseConventionSchema.tags,
      };
      tagsAreSet = true;
    }

    result = {
      ...internalId(),
      "type": "object",
      description,
    };

    if (exhaustive) {
      result.exhaustiveCompletions = true;
    }

    if (properties) {
      result.properties = properties;
    }

    if (patternProperties) {
      result.patternProperties = patternProperties;
    }

    if (required && required.length > 0) {
      result.required = required;
    }

    result.closed = closed;

    // this is useful to characterize Record<string, foo> types: use
    // objectSchema({}, [], foo)
    //
    // additionalProperties can be either a schema or "false", so
    // we need to check for undefined instead of a simple truthy check
    if (additionalProperties !== undefined) {
      result.additionalProperties = additionalProperties;
    }

    if (propertyNames !== undefined) {
      result.propertyNames = propertyNames;
    }
  }

  if (tagsAreSet) {
    result.tags = tags;
  }
  return result;
}

export function arraySchema(items?: Schema): ArraySchema {
  if (items) {
    return {
      ...internalId(),
      "type": "array",
      "description": `be an array of values, where each element must ${
        schemaDescription(items)
      }`,
      items,
    };
  } else {
    return {
      ...internalId(),
      "type": "array",
      "description": `be an array of values`,
    };
  }
}

export function documentSchema<T extends ConcreteSchema>(
  schema: T,
  doc: string,
): T {
  const result = Object.assign({}, schema);
  result.documentation = doc;
  return result;
}

// this overrides the automatic description
export function describeSchema<T extends ConcreteSchema>(
  schema: T,
  description: string,
): T {
  const result = Object.assign({}, schema);
  result.description = `be ${description}`;
  return result;
}

export function completeSchema<T extends ConcreteSchema>(
  schema: T,
  ...completions: string[]
): T {
  const result = Object.assign({}, schema);
  const prevCompletions = (schema.completions || []).slice();
  prevCompletions.push(...completions);
  result.completions = prevCompletions;
  return result;
}

export function completeSchemaOverwrite<T extends ConcreteSchema>(
  schema: T,
  ...completions: string[]
): T {
  const result = Object.assign({}, schema);
  result.completions = completions;
  return result;
}

export function idSchema<T extends ConcreteSchema>(schema: T, id: string): T {
  const result = Object.assign({}, schema);
  result["$id"] = id;
  return result;
}

export function errorMessageSchema<T extends ConcreteSchema>(
  schema: T,
  errorMessage: string,
): T {
  return {
    ...schema,
    errorMessage,
  };
}

// JSON schemas don't even allow $ref to have descriptions,
// but we use it here to allow our automatic description creation
export function refSchema($ref: string, description: string): RefSchema {
  return {
    ...internalId(),
    "type": "ref",
    $ref,
    description,
  };
}

export function valueSchema(
  val: number | boolean | string,
  description?: string,
): EnumSchema {
  return {
    ...internalId(),
    "type": "enum",
    "enum": [val], // enum takes non-strings too (!)
    "description": description || `be ${JSON.stringify(val)}`,
  };
}
