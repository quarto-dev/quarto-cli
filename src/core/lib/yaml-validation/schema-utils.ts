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
  walkSchema,
} from "./schema.ts";
import { prefixes } from "../regexp.js";

import { navigateSchemaBySchemaPathSingle } from "./schema-navigation.ts";

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
    engines: Schema; // FIXME engines is not a single schema!!
  };
  aliases: Record<string, string[]>;
  definitions: Record<string, Schema>;
}

let _schemas: QuartoJsonSchemas = {
  schemas: {
    "front-matter": undefined,
    config: undefined,
    engines: undefined,
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

export function maybeResolveSchema(schema: Schema): Schema | undefined {
  try {
    return resolveSchema(schema);
  } catch (e) {
    return undefined;
  }
}

export function resolveDescription(s: string | { $ref: string }): string {
  if (typeof s === "string") {
    return s;
  }
  const valueS = resolveSchema(s.$ref);
  if (valueS.documentation) {
    if (valueS.documentation.short) {
      return valueS.documentation.short as string;
    } else {
      return valueS.documentation as string;
    }
  } else {
    return "";
  }
}

export function resolveSchema(
  schema: Schema,
  visit?: (schema: Schema) => void,
  hasRef?: (schema: Schema) => boolean,
  next?: (schema: Schema) => Schema,
): Schema {
  if (hasRef === undefined) {
    hasRef = (cursor: Schema) => {
      return cursor.$ref !== undefined;
    };
  }
  if (!hasRef(schema)) {
    return schema;
  }
  if (visit === undefined) {
    visit = (schema: Schema) => {};
  }
  if (next === undefined) {
    next = (cursor: Schema) => {
      const result = getSchemaDefinition(cursor.$ref);
      if (result === undefined) {
        throw new Error(
          `Internal Error: ref ${cursor.$ref} not in definitions`,
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

  let cursor1: Schema = schema;
  let cursor2: Schema = schema;
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

export function schemaCompletions(schema: Schema): Completion[] {
  // first resolve through $ref
  schema = resolveSchema(schema);

  // then resolve through "complete-from" schema tags
  schema = resolveSchema(
    schema,
    (schema: Schema) => {}, // visit
    (schema: Schema) => {
      return schema.tags && schema.tags["complete-from"];
    },
    (schema: Schema) => {
      return navigateSchemaBySchemaPathSingle(
        schema,
        schema.tags["complete-from"],
      );
    },
  );

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
    schema.tags && schema.tags.completions && schema.tags.completions.length
  ) {
    return normalize(schema.tags.completions);
  }

  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        return schemaCompletions(schema.items);
      } else {
        return [];
      }
    case "anyOf":
      return schema.anyOf.map(schemaCompletions).flat();
    case "oneOf":
      return schema.oneOf.map(schemaCompletions).flat();
    case "allOf":
      return schema.allOf.map(schemaCompletions).flat();
    case "object":
      // we actually mutate the schema here to avoid recomputing.
      schema.completions = getObjectCompletions(schema);
      return normalize(schema.completions);
    default:
      return [];
  }
}

function getObjectCompletions(schema: Schema): Completion[] {
  const completionsParam = schema.tags && schema.tags.completions;
  const properties = schema.properties;
  const objectKeys = Object.getOwnPropertyNames(completionsParam || properties);
  const uniqueValues = (lst: Completion[]) => {
    const obj: Record<string, Completion> = {};
    for (const c of lst) {
      obj[c.value] = c;
    }
    return Object.getOwnPropertyNames(obj).map((k) => obj[k]);
  };

  const completions: Completion[] = [];
  for (const k of objectKeys) {
    const schema = properties[k];
    const maybeDescriptions: (undefined | string | { $ref: string })[] = [
      completionsParam && completionsParam[k],
    ];
    let hidden = false;
    if (schema !== undefined) {
      if (schema.documentation) {
        // if a ref schema has documentation, use that directly.
        maybeDescriptions.push(
          schema && schema.documentation && schema.documentation.short,
        );
        maybeDescriptions.push(schema && schema.documentation);
      } else {
        // in the case of recursive schemas, a back reference to a schema
        // that hasn't been registered yet is bound to fail.  In that
        // case, maybeResolveSchema will return undefined, and we
        // potentially store a special description entry, deferring the
        // resolution to runtime.
        let described = false;
        const visitor = (schema: Schema) => {
          if (schema && schema.hidden) {
            hidden = true;
          }
          if (described) {
            return;
          }
          if (schema && schema.documentation && schema.documentation.short) {
            maybeDescriptions.push(
              schema && schema.documentation && schema.documentation.short,
            );
            described = true;
          } else if (schema && schema.documentation) {
            maybeDescriptions.push(schema && schema.documentation);
            described = true;
          }
        };
        try {
          resolveSchema(schema, visitor);
        } catch (e) {
          // TODO catch only the lookup exception
        }
        if (!described && schema && schema.$ref) {
          maybeDescriptions.push({ $ref: schema && schema.$ref });
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
      suggest_on_accept: schema && schema.completions &&
        schema.completions.length !== 0,
    });
  }

  return completions;
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
    "object": (s) => {
      results.push(...Object.keys(s.properties || {}));
      return true;
    },
    "array": (s) => true,
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
    "enum": (s) => {
      results.push(...s["enum"].map(String));
      return true;
    },
    // don't recurse into anything that introduces instancePath values
    "array": (s) => true,
    "object": (s) => true,
  });
  return results;
}
