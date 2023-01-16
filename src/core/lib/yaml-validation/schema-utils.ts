/*
* schema-utils.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { navigateSchemaBySchemaPathSingle } from "./schema-navigation.ts";

import {
  AllOfSchema,
  AnyOfSchema,
  ArraySchema,
  Completion,
  ConcreteSchema,
  EnumSchema,
  ObjectSchema,
  RefSchema,
  Schema,
  SchemaCall,
  schemaCall,
  schemaDispatch,
  schemaDocString,
} from "../yaml-schema/types.ts";

import { resolveSchema } from "./resolve.ts";

export function resolveDescription(s: string | RefSchema): string {
  if (typeof s === "string") {
    return s;
  }
  const valueS = resolveSchema(s);
  if (valueS === false || valueS === true) {
    return "";
  }
  if (valueS.documentation === undefined) {
    return "";
  }
  if (typeof valueS.documentation === "string") {
    return valueS.documentation;
  }

  if (valueS.documentation.short) {
    return valueS.documentation.short;
  } else {
    return "";
  }
}

export function schemaCompletions(s: Schema): Completion[] {
  if (s === true || s === false) {
    return [];
  }

  // first resolve through $ref
  let schema = resolveSchema(s);

  // then resolve through "complete-from" schema tags
  schema = resolveSchema(
    schema,
    (_schema: ConcreteSchema) => {}, // visit
    (schema: ConcreteSchema) => {
      return (schema.tags !== undefined) &&
        (schema.tags["complete-from"] !== undefined);
    },
    (schema: ConcreteSchema) => {
      return navigateSchemaBySchemaPathSingle(
        schema,
        schema.tags!["complete-from"] as ((number | string)[]),
      );
    },
  );

  if (schema === true || schema === false) {
    return [];
  }

  // TODO this is slightly inefficient since recursions call
  // normalize() multiple times

  // deno-lint-ignore no-explicit-any
  const normalize = (completions: any) => {
    // deno-lint-ignore no-explicit-any
    const result = (completions || []).map((c: any) => {
      if (typeof c === "string") {
        return {
          type: "value",
          display: c,
          value: c,
          description: "",
          suggest_on_accept: false,
          schema,
        };
      }
      return {
        ...c,
        description: resolveDescription(c.description),
        schema,
      };
    });
    return result;
  };

  if (schema.completions && schema.completions.length) {
    return normalize(schema.completions);
  }

  if (
    schema.tags && schema.tags.completions
  ) {
    if (
      Array.isArray(schema.tags.completions) &&
      schema.tags.completions.length
    ) {
      return normalize(schema.tags.completions);
    } else {
      return normalize(
        Object.values(schema.tags.completions as Record<string, unknown>),
      );
    }
  }

  return schemaCall(schema, {
    array: (s) => {
      if (s.items) {
        return schemaCompletions(s.items);
      } else {
        return [];
      }
    },
    anyOf: (s) => {
      return s.anyOf.map(schemaCompletions).flat();
    },
    allOf: (s) => {
      return s.allOf.map(schemaCompletions).flat();
    },
    "object": (s) => {
      // we actually mutate the schema here to avoid recomputing.
      s.cachedCompletions = getObjectCompletions(s);
      return normalize(s.cachedCompletions);
    },
  }, (_) => []);
}

function getObjectCompletions(s: ConcreteSchema): Completion[] {
  const completionsParam: string[] =
    (s.tags && s.tags.completions as string[]) || [];
  return schemaCall(s, {
    "object": (schema) => {
      const properties = schema.properties;
      const objectKeys = completionsParam.length
        ? completionsParam
        : Object.getOwnPropertyNames(properties);
      const _uniqueValues = (lst: Completion[]) => {
        const obj: Record<string, Completion> = {};
        for (const c of lst) {
          obj[c.value] = c;
        }
        return Object.getOwnPropertyNames(obj).map((k) => obj[k]);
      };

      const completions: Completion[] = [];
      for (const k of objectKeys) {
        const schema = properties && properties[k];
        const maybeDescriptions: (undefined | string | { $ref: string })[] = [];
        let hidden = false;
        if (schema !== undefined && schema !== true && schema !== false) {
          // if a ref schema has documentation, use that directly.
          if (schema.documentation) {
            maybeDescriptions.push(schemaDocString(schema.documentation));
          } else {
            // in the case of recursive schemas, a back reference to a schema
            // that hasn't been registered yet is bound to fail.  In that
            // case, maybeResolveSchema will return undefined, and we
            // potentially store a special description entry, deferring the
            // resolution to runtime.
            let described = false;
            const visitor = (schema: Schema) => {
              if (schema === false || schema === true) {
                return;
              }
              if (schema.hidden) {
                hidden = true;
              }
              if (described) {
                return;
              }
              if (schema.documentation) {
                maybeDescriptions.push(schemaDocString(schema.documentation));
                described = true;
              }
            };
            try {
              resolveSchema(schema, visitor);
            } catch (_e) {
              // TODO catch only the lookup exception
            }
            if (!described) {
              schemaDispatch(schema, {
                ref: (schema) => maybeDescriptions.push({ $ref: schema.$ref }),
              });
            }
          }
        }
        if (hidden) {
          continue;
        }
        let description: (string | { $ref: string }) = "";
        for (const md of maybeDescriptions) {
          if (md !== undefined) {
            description = md;
            break;
          }
        }
        completions.push({
          type: "key",
          display: "", // attempt to not show completion title.
          value: `${k}: `,
          description,
          suggest_on_accept: true,
        });
      }
      return completions;
    },
  }, (_) =>
    completionsParam.map((c) => ({
      type: "value",
      display: "",
      value: c,
      description: "",
      suggest_on_accept: false,
    })));
}

export function possibleSchemaKeys(schema: Schema): string[] {
  const precomputedCompletions = schemaCompletions(schema).filter((c) =>
    c.type === "key"
  ).map((c) => c.value.split(":")[0]);
  if (precomputedCompletions.length) {
    return precomputedCompletions;
  }

  // FIXME we likely got unlucky and were handed an unnamed schema
  // from inside an ajv error.

  const results: string[] = [];
  // we do a best-effort thing here.
  walkSchema(schema, {
    "object": (s: ObjectSchema) => {
      results.push(...Object.keys(s.properties || {}));
      return true;
    },
    "array": (_s: ArraySchema) => true,
  });
  return results;
}

export function possibleSchemaValues(schema: Schema): string[] {
  // FIXME we likely got unlucky and were handed an unnamed schema
  // from inside an ajv error.

  const results: string[] = [];
  // we do a best-effort thing here.
  walkSchema(schema, {
    "enum": (s: EnumSchema) => {
      results.push(...s["enum"].map(String));
      return true;
    },
    // don't recurse into anything that introduces instancePath values
    "array": (_s: ArraySchema) => true,
    "object": (_s: ObjectSchema) => true,
  });
  return results;
}

export function walkSchema(
  schema: Schema,
  f: ((a: Schema) => boolean | void) | SchemaCall<boolean | void>,
) {
  const recur = {
    "anyOf": (ss: AnyOfSchema) => {
      for (const s of ss.anyOf) {
        walkSchema(s, f);
      }
    },
    "allOf": (ss: AllOfSchema) => {
      for (const s of ss.allOf) {
        walkSchema(s, f);
      }
    },
    "array": (x: ArraySchema) => {
      if (x.items) {
        walkSchema(x.items, f);
      }
    },
    "object": (x: ObjectSchema) => {
      if (x.properties) {
        for (const ss of Object.values(x.properties)) {
          walkSchema(ss, f);
        }
      }
      if (x.patternProperties) {
        for (const ss of Object.values(x.patternProperties)) {
          walkSchema(ss, f);
        }
      }
      if (x.propertyNames) {
        walkSchema(x.propertyNames, f);
      }
    },
  };

  if (typeof f === "function") {
    if (f(schema) === true) {
      return;
    }
  } else {
    if (schemaCall(schema, f, (_: Schema) => false) === true) {
      return;
    }
  }

  schemaCall(schema, recur, (_: Schema) => false);
}
