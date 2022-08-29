/*
* interface.ts
*
* Builds typescript types from our schema
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

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
        Object.entries(schema.record.properties).map(([key, value]) => {
          return `${key}: ${schemaToType(value)}`;
        }).join("; ") + "}";
    }
    if (schema.enum) {
      if (!Array.isArray(schema.enum)) {
        throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
      }
      return "(" + schema.enum.map((x: unknown) =>
        JSON.stringify(x)
      ).join(" | ") + ")";
    }
    if (schema.ref) {
      return toCapitalizeCase(schema.ref);
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
      const mainType = "{" +
        Object.entries(schema.object.properties).map(([key, value]) => {
          const optionalFlag = schema.required === "all"
            ? false
            : (schema.required === undefined
              ? true
              : schema.required.indexOf(key) === -1);
          return `${key.indexOf("-") !== -1 ? JSON.stringify(key) : key}${
            optionalFlag ? "?" : ""
          }: ${schemaToType(value)}`;
        }).sort(([k1, _v1], [k2, _v2]) => k1.localeCompare(k2)).join("; ") +
        "}";
      if (schema.object?.super?.resolveRef) {
        return "(" + mainType + " & " +
          toCapitalizeCase(schema.object?.super?.resolveRef) + ")";
      } else {
        return mainType;
      }
    }
  }
  throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
}

function toCapitalizeCase(s: string) {
  return s.replace(/^([a-z])/, (sub: string) => sub.toLocaleUpperCase())
    .replaceAll(/([-][a-z])/g, (sub: string) => sub[1].toLocaleUpperCase());
}
