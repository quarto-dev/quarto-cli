/*
* interface.ts
*
* Builds typescript types from our schema
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { toCapitalizationCase } from "../lib/text.ts";
import { capitalize } from "../text.ts";

// deno-lint-ignore no-explicit-any
export function schemaToType(schema: any): string {
  if ([true, false, null].indexOf(schema) !== -1) {
    return String(schema);
  }

  if (typeof schema === "string") {
    switch (schema) {
      case "number":
      case "boolean":
      case "string":
      case "null":
        return schema;
      case "path":
        return "string";
      case "object":
        return "SchemaObject";
    }
    throw new Error(`Unimplemented: ${schema}`);
  }

  if (typeof schema === "object") {
    if (schema.schema) return schemaToType(schema.schema);
    if (schema.string) {
      return "string";
    }
    if (schema.number) {
      return "number";
    }
    if (schema.boolean) {
      return "boolean";
    }
    if (schema.path) {
      return "string";
    }
    if (schema.arrayOf) {
      return `(${schemaToType(schema.arrayOf)})[]`;
    }
    if (schema.maybeArrayOf) {
      const t = schemaToType(schema.maybeArrayOf);
      return `MaybeArrayOf<${t}>`;
    }
    if (schema.record) {
      return "{" +
        Object.entries(schema.record).map(([key, value]) => {
          return `${key}: ${schemaToType(value)}`;
        }).join("; ") + "}";
    }
    if (schema.enum) {
      // deno-lint-ignore no-explicit-any
      const doIt = (v: any) => {
        if (v.length === 1) {
          return JSON.stringify(v[0]);
        }
        return "(" + v.map((x: unknown) => JSON.stringify(x)).join(" | ") +
          ")";
      };
      if (Array.isArray(schema.enum.values)) {
        return doIt(schema.enum.values);
      }
      if (!Array.isArray(schema.enum)) {
        throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
      }
      return doIt(schema.enum);
    }
    if (schema.ref) {
      return capitalize(toCapitalizationCase(schema.ref));
    }
    if (schema.allOf) {
      if (!Array.isArray(schema.allOf)) {
        throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
      }
      return "(" + schema.allOf.map(schemaToType).join(" & ") + ")";
    }
    if (schema.anyOf) {
      if (!Array.isArray(schema.anyOf)) {
        throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
      }
      return "(" + schema.anyOf.map(schemaToType).join(" | ") + ")";
    }
    if (schema.object) {
      const mainType = (schema.object.properties === undefined)
        ? "SchemaObject"
        : ("{" +
          Object.entries(schema.object.properties).map(([key, value]) => {
            const optionalFlag = schema.object.required === "all"
              ? false
              : (schema.object.required === undefined
                ? true
                : schema.object.required.indexOf(key) === -1);
            return `${key.indexOf("-") !== -1 ? JSON.stringify(key) : key}${
              optionalFlag ? "?" : ""
            }: ${schemaToType(value)}`;
          }).sort(([k1, _v1], [k2, _v2]) => k1.localeCompare(k2)).join("; ") +
          "}");
      if (schema.object?.super?.resolveRef) {
        return "(" + mainType + " & " +
          capitalize(
            toCapitalizationCase(schema.object?.super?.resolveRef) + ")",
          );
      } else {
        return mainType;
      }
    }
  }
  throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
}
