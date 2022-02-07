/*
* schema-utils.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  Completion,
  getSchemaDefinition,
  Schema,
  schemaType,
} from "./schema.ts";

import { prefixes } from "../regexp.js";

import { navigateSchemaBySchemaPathSingle } from "./schema-navigation.ts";

import {
  AllOfSchema,
  AnyOfSchema,
  ArraySchema,
  ConcreteSchema,
  EnumSchema,
  ObjectSchema,
  OneOfSchema,
  RefSchema,
  SchemaCall,
  schemaCall,
  schemaDocString,
} from "./validator/types.ts";

// NB: QuartoJsonSchemas is meant for serialization of the entire body of schemas
// For actual schema use in quarto, use either the definitions in core/schema
// or call getSchemaDefinition(). _in particular_, the definitions field in _schemas
// might be stale!
//
// TODO this probably needs a good refactoring, but you've been warned.

// TODO typings for quarto-json-schemas.json
export interface QuartoJsonSchemas {
  schemas: {
    "front-matter": Schema;
    config: Schema;
    engines: Record<string, Schema>; // FIXME engines is not a single schema!!
  };
  aliases: Record<string, string[]>;
  definitions: Record<string, ConcreteSchema>;
}

let _schemas: QuartoJsonSchemas = {
  schemas: {
    "front-matter": false,
    config: false,
    engines: {},
  },
  aliases: {},
  definitions: {},
};

// this is an escape hatch for the quarto CLI to install the schema
// files appropriately.
export function setSchemas(schemas: QuartoJsonSchemas) {
  _schemas = schemas;
}

export function getSchemas(): QuartoJsonSchemas {
  if (_schemas) {
    return _schemas;
  } else {
    throw new Error("Internal error: schemas not set");
  }
}

export function maybeResolveSchema(
  schema: ConcreteSchema,
): ConcreteSchema | true | false | undefined {
  try {
    return resolveSchema(schema);
  } catch (e) {
    return undefined;
  }
}

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

export function resolveSchema(
  schema: ConcreteSchema | false | true,
  visit?: (schema: ConcreteSchema) => void,
  hasRef?: (schema: ConcreteSchema) => boolean,
  next?: (schema: ConcreteSchema) => ConcreteSchema,
): ConcreteSchema | false | true {
  if (schema === false || schema === true) {
    return schema;
  }
  if (hasRef === undefined) {
    hasRef = (cursor: ConcreteSchema) => {
      return schemaCall(cursor, {
        ref: (s) => true,
      }, (s) => false);
    };
  }
  if (!hasRef(schema)) {
    return schema;
  }
  if (visit === undefined) {
    visit = (schema: ConcreteSchema) => {};
  }
  if (next === undefined) {
    next = (cursor: ConcreteSchema) => {
      const result = schemaCall(cursor, {
        ref: (s) => getSchemaDefinition(s.$ref),
      });
      if (result === undefined) {
        throw new Error(
          "Internal Error, couldn't resolve schema ${JSON.stringify(cursor)}",
        );
      }
      return result;
    };
  }

  // this is on the chancy side of clever, but we're going to be extra
  // careful here and use the cycle-detecting trick. This code runs
  // in the IDE and I _really_ don't want to accidentally freeze them.
  //
  // I'm sufficiently dismayed by badly-written emacs modes that randomly
  // freeze on me from some unforeseen looping condition that I want
  // to go out of my way to avoid this for our users.

  let cursor1: ConcreteSchema = schema;
  let cursor2: ConcreteSchema = schema;
  let stopped = false;
  do {
    cursor1 = next(cursor1);
    visit(cursor1);
    // we don't early exit here. instead, we stop cursor2 and let cursor1 catch up.
    // This way, visit(cursor1) covers everything in order.
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    // move cursor2 twice as fast to detect cycles.
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    if (!stopped && cursor1 === cursor2) {
      throw new Error(`reference cycle detected at ${JSON.stringify(cursor1)}`);
    }
  } while (hasRef(cursor1));

  return cursor1;
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
    (schema: ConcreteSchema) => {}, // visit
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
    schema.tags && schema.tags.completions &&
    (schema.tags.completions as string[]).length
  ) {
    return normalize(schema.tags.completions);
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
    oneOf: (s) => {
      return s.oneOf.map(schemaCompletions).flat();
    },
    allOf: (s) => {
      return s.allOf.map(schemaCompletions).flat();
    },
    "object": (s) => {
      // we actually mutate the schema here to avoid recomputing.
      s.cachedCompletions = getObjectCompletions(s);
      return normalize(s.completions);
    },
  }, (_) => []);
}

function getObjectCompletions(s: ConcreteSchema): Completion[] {
  const completionsParam: string[] =
    (s.tags && s.tags.completions as string[]) || [];
  return schemaCall(s, {
    "object": (schema) => {
      const properties = schema.properties;
      const objectKeys = Object.getOwnPropertyNames(
        completionsParam || properties,
      );
      const uniqueValues = (lst: Completion[]) => {
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
            } catch (e) {
              // TODO catch only the lookup exception
            }
            if (!described) {
              schemaCall(schema, {
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
          suggest_on_accept: (schema !== undefined) &&
            (schema != false) &&
            (schema !== true) &&
            (schema.completions !== undefined) &&
            (schema.completions.length !== 0),
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
    "array": (s: ArraySchema) => true,
  });
  return results;
}

export function possibleSchemaValues(schema: Schema): string[] {
  const precomputedCompletions = schemaCompletions(schema).filter((c) =>
    c.type === "value"
  )
    .map((c) => c.value.split(":")[0]);

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
    "array": (s: ArraySchema) => true,
    "object": (s: ObjectSchema) => true,
  });
  return results;
}

export function walkSchema(
  schema: Schema,
  f: ((a: Schema) => boolean | void) | SchemaCall<boolean | void>,
) {
  const recur = {
    "oneOf": (ss: OneOfSchema) => {
      for (const s of ss.oneOf) {
        walkSchema(s, f);
      }
    },
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
    "ref": (x: RefSchema) => {
      walkSchema(resolveSchema(x), f);
    },
  };

  if (typeof f === "function") {
    if (f(schema) === true) {
      return;
    }
  } else {
    if (schemaCall(schema, f) === true) {
      return;
    }
  }

  schemaCall(schema, recur, (_: Schema) => true);
}
