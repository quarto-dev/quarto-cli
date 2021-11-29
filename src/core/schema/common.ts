/*
* common.ts
*
* Common JSON Schema objects
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// we build up our little schema combinator library here.
// Right now it just emits a JSON schema but this is setting up for
// when we want to enrich our schema with other things like documentation etc

import {
  Completion,
  Schema,
  schemaExhaustiveCompletions,
} from "../lib/schema.ts";

export const BooleanSchema = {
  "type": "boolean",
  "description": "be a boolean value",
  "completions": ["true", "false"],
  "exhaustiveCompletions": true,
};

export const NumberSchema = {
  "type": "number",
  "description": "be a number",
};

export const IntegerSchema = {
  "type": "integer",
  "description": "be an integral number",
};

export function numericSchema(obj: {
  "type": "integer" | "number";
  "minimum"?: number;
  "maximum"?: number;
  "exclusiveMinimum"?: number;
  "exclusiveMaximum"?: number;
  "multipleOf"?: number;
  "description"?: string;
}) {
  return Object.assign({
    description: "be a number",
  }, obj);
}

export const StringSchema = {
  "type": "string",
  "description": "be a string",
};

export const anySchema = {
  "description": "be anything",
};

// NB this is different from a schema that accepts nothing
// this schema accepts `null`
export const NullSchema = {
  "type": "null",
  "description": "be the null value",
  "completions": ["null"],
  "exhaustiveCompletions": true,
};

export function enumSchema(...args: string[]) {
  if (args.length === 0) {
    throw new Error("Internal Error: Empty enum schema not supported.");
  }
  return {
    "enum": args,
    "description": args.length > 1
      ? `be one of: ${args.map((x) => "'" + x + "'").join(", ")}`
      : `be '${args[0]}'`,
    "completions": args,
    "exhaustiveCompletions": true,
  };
}

export function oneOfSchema(...args: Schema[]) {
  return {
    "oneOf": args,
    "description": `be exactly one of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

export function anyOfSchema(...args: Schema[]) {
  return {
    "anyOf": args,
    "description": `be at least one of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

export function allOfSchema(...args: Schema[]) {
  return {
    "allOf": args,
    "description": `be all of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

// FIXME: add dynamic check for requiredProps being a subset of the
// keys in properties
export function objectSchema(params: {
  properties?: { [k: string]: Schema };
  required?: string[];
  exhaustive?: boolean;
  additionalProperties?: Schema;
  description?: string;
  // deno-lint-ignore no-explicit-any
  baseSchema?: any; // FIXME this should have the type of the result of objectSchema()
  completions?: { [k: string]: string };
} = {}) {
  let {
    properties,
    required,
    additionalProperties,
    description,
    baseSchema,
    exhaustive,
    completions: completionsParam,
  } = params;

  required = required || [];
  properties = properties || {};

  const hasDescription = description !== undefined;
  description = description || "be an object";
  let result: Schema | undefined = undefined;
  const completions: Completion[] = [];

  const uniqueValues = (lst: Completion[]) => {
    const obj: Record<string, Completion> = {};
    for (const c of lst) {
      obj[c.value] = c;
    }

    return Object.getOwnPropertyNames(obj).map((k) => obj[k]);
  };

  for (
    const k of Object.getOwnPropertyNames(
      completionsParam || properties,
    )
  ) {
    const valueS = properties[k];

    completions.push({
      type: "key",
      display: k,
      value: `${k}: `,
      description: completionsParam?.[k] || "",
      suggest_on_accept: valueS && schemaExhaustiveCompletions(valueS),
    });
  }

  if (baseSchema) {
    if (baseSchema.type !== "object") {
      throw new Error("Internal Error: can only extend other object Schema");
    }
    result = Object.assign({}, baseSchema);

    if (exhaustive && baseSchema.exhaustiveCompletions) {
      result.exhaustiveCompletions = true;
    }

    if (hasDescription) {
      result.description = description;
    }

    result.properties = Object.assign({}, result.properties, properties);

    if (required) {
      result.required = (result.required ?? []).slice();
      result.required.push(...required);
    }

    if (
      (result.completions && result.completions.length) ||
      completions.length
    ) {
      result.completions = (result.completions || []).slice();
      result.completions.push(...completions);
      result.completions = uniqueValues(result.completions);
    }

    if (additionalProperties !== undefined) {
      // FIXME Review. This is likely to be confusing, but I think
      // it's the correct semantics for subclassing
      if (result.additionalProperties === false) {
        throw new Error(
          "Internal Error: don't know how to subclass object schema with additionalProperties === false",
        );
      }
      if (result.additionalProperties) {
        result.additionalProperties = allOfSchema(
          result.additionalProperties,
          additionalProperties,
        );
      } else {
        result.additionalProperties = additionalProperties;
      }
    }
  } else {
    result = {
      "type": "object",
      description,
    };

    if (exhaustive) {
      result.exhaustiveCompletions = true;
    }

    if (properties) {
      result.properties = properties;
    }

    if (required && required.length > 0) {
      result.required = required;
    }

    if (completions.length) {
      result.completions = completions;
    }

    // this is useful to characterize Record<string, foo> types: use
    // objectSchema({}, [], foo)
    //
    // additionalProperties can be either a schema or "false", so
    // we need to check for undefined instead of a simple truthy check
    if (additionalProperties !== undefined) {
      result.additionalProperties = additionalProperties;
    }
  }

  return result;
}

export function arraySchema(items?: Schema) {
  if (items) {
    return {
      "type": "array",
      "description": `be an array of values, where each element should ` +
        items.description,
      items,
    };
  } else {
    return {
      "type": "array",
      "description": `be an array of values`,
    };
  }
}

export function documentSchema(schema: Schema, doc: string) {
  const result = Object.assign({}, schema);
  result.documentation = doc;
  return result;
}

export function completeSchema(schema: Schema, ...completions: Completion[]) {
  const result = Object.assign({}, schema);
  const prevCompletions = (schema.completions ?? []).slice();
  prevCompletions.push(...completions);
  result.completions = completions;
  return result;
}

export function idSchema(schema: Schema, id: string) {
  const result = Object.assign({}, schema);
  result["$id"] = id;
  return result;
}

// JSON schemas don't even allow $ref to have descriptions,
// but we use it here to allow our automatic description creation
export function refSchema($ref: string, description: string) {
  return {
    $ref,
    description,
  };
}
