/*
 * json-schema-from-schema.ts
 *
 * generates a JSON schema object from our yaml schema definitions.
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import {
  schemaDefinitions,
  typeNameFromSchemaName,
} from "./types-from-schema.ts";
import {
  JsonObject,
  SchemaSchema,
} from "../../resources/types/schema-schema-types.ts";

// https://json-schema.org/draft/2020-12/json-schema-core#name-json-schema-documents
type JsonSchema = JsonObject | boolean;
type JsonSchemaDefs = Record<string, JsonSchema>;

const convertSchemaToJSONSchema = (_schema: SchemaSchema): JsonSchema => {
  const schema = _schema as any;
  if (schema) {
    if (typeof schema === "string") {
      const dispatch: Record<string, JsonSchema> = {
        number: { type: "number" },
        boolean: { type: "boolean" },
        string: { type: "string" },
        path: { type: "string" },
        object: { type: "object" },
        any: {},
      };
      const result = dispatch[schema];
      if (!result) {
        throw new Error(`Unknown schema type: ${schema}`);
      }
      return result;
    } else if (typeof schema === "object") {
      if (schema.schema) {
        return convertSchemaToJSONSchema(schema.schema);
      }
      if (schema.enum) {
        return {
          enum: schema.enum,
        };
      }
      if (schema.anyOf) {
        return {
          anyOf: schema.anyOf.map(convertSchemaToJSONSchema),
        };
      }
      if (schema.allOf) {
        return {
          allOf: schema.allOf.map(convertSchemaToJSONSchema),
        };
      }
      if (schema.arrayOf) {
        return {
          type: "array",
          items: convertSchemaToJSONSchema(schema.arrayOf),
        };
      }
      if (schema.record) {
        return {
          object: {
            properties: Object.fromEntries(
              Object.entries(schema.record).map(([key, value]) => [
                key,
                convertSchemaToJSONSchema(value as any),
              ]),
            ),
            required: Object.keys(schema.record),
            additionalProperties: false,
          },
        };
      }
      if (schema.object) {
        return {
          object: {
            properties: Object.fromEntries(
              Object.entries(schema.object.properties ?? {}).map((
                [key, value],
              ) => [
                key,
                convertSchemaToJSONSchema(value as any),
              ]),
            ),
            required: schema.required,
          },
        };
      }
      if (schema.ref) {
        return {
          "$ref": "#/$defs/" + typeNameFromSchemaName(schema.ref),
        };
      }
      if (schema.maybeArrayOf) {
        const items = convertSchemaToJSONSchema(schema.maybeArrayOf);
        return {
          anyOf: [
            {
              type: "array",
              items,
            },
            items,
          ],
        };
      }
      if (schema.string) {
        // FIXME probably need to do more here in case there's more fields
        return {
          type: "string",
        };
      }
      if (schema.boolean) {
        return {
          type: "boolean",
        };
      }
      if (schema.number) {
        return {
          type: "number",
        };
      }
      if (schema.path) {
        return {
          type: "string",
        };
      }
    } else {
      console.log({ schema });
      console.log(typeof schema);
      throw new Error(`fallthrough?`);
    }
  } else {
    if (schema === null) {
      return {
        enum: [null],
      };
    }
  }
  console.log(JSON.stringify(schema, null, 2));
  throw new Error("Not implemented");
};

export const generateJsonSchemasFromSchemas = async (resourcePath: string) => {
  const quartoSchemas = schemaDefinitions(resourcePath);

  const defs = quartoSchemas
    .reduce((acc: JsonSchemaDefs, { name, schema }) => {
      try {
        acc[name] = convertSchemaToJSONSchema(schema);
      } catch (e) {
        console.log("Outermost failing schema:");
        console.log(JSON.stringify(schema));
        throw e;
      }
      return acc;
    }, {});

  const schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$defs": defs,
  };

  Deno.writeTextFileSync(
    `${resourcePath}/schema/json-schemas.json`,
    JSON.stringify(schema, null, 2),
  );
};
