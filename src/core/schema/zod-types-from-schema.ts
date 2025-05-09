/*
 * zod-types-from-schema.ts
 *
 * Tools to convert our schemas to Zod schemas.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

/*

This file intentionally does not import from a number of quarto libraries
in order to minimize its dependencies.

We do this because you might need to run this file to regenerate quarto types,
and it's possible that you're doing it from a position where `quarto` doesn't
itself run.

*/

import { ensureDirSync } from "../../deno_ral/fs.ts";
import { join } from "../../deno_ral/path.ts";
import {
  fmtSource,
  generatedSrcMessage,
  schemaDefinitions,
  typeNameFromSchemaName,
  yamlToTypeScriptKey,
} from "./types-from-schema.ts";

class ZodDeclarationFileBuilder {
  constructor() {
    this.declarations = [];
    this.inferredTypes = [];
  }

  declarations: string[] = [];
  inferredTypes: string[] = [];

  // we keep track of the schemas we've seen so we can
  // process resolve-ref schemas
  // deno-lint-ignore no-explicit-any
  schemas: Record<string, any> = {};

  // deno-lint-ignore no-explicit-any
  addSchema(obj: { name: string; schema: any }, inComments = false) {
    this.schemas[obj.name] = obj.schema;
    const schemaName = typeNameFromSchemaName(obj.name);
    const schema = obj.schema;
    const zodType = this.convertToZodJsSource(schema);
    const startComment = inComments ? "/* " : "";
    const endComment = inComments ? " */" : "";
    this.declarations.push(
      `${startComment}export const Zod${schemaName} = ${zodType};${endComment}\n`,
    );
    this.inferredTypes.push(
      `${startComment}export type ${schemaName} = z.infer<typeof Zod${schemaName}>;${endComment}\n`,
    );
  }

  fileSource(): string {
    const zodDeclarations = this.declarations.join("\n");
    const zodInferredTypes = this.inferredTypes.join("\n");
    const zodObject = (() => {
      const lines = [
        "export const Zod = {",
      ];
      Object.keys(this.schemas).forEach((name) => {
        const typeName = typeNameFromSchemaName(name);
        lines.push(
          `  ${typeName}: Zod${typeName},`,
        );
      });
      lines.push("};");
      return lines.join("\n");
    })();
    return `import { z } from "zod";

import { ZodSidebarContents, ZodNavigationItem, ZodNavigationItemObject } from "./handwritten-schema-types.ts";
export { ZodSidebarContents, ZodNavigationItem, ZodNavigationItemObject } from "./handwritten-schema-types.ts";

${generatedSrcMessage}

${zodDeclarations}
${zodInferredTypes}

${zodObject}
`;
  }

  // deno-lint-ignore no-explicit-any
  convertToZodJsSource(schema: any): string {
    // we're doing a syntax-directed translation of the schema objects
    // as they exist in our JSON format. Follow schema-schema-types.ts
    // for the schema types themselves.
    //
    // To reiterate, we don't import that file directly here to avoid
    // bootstrapping problems in the case the build process errors out.

    const result = this.convertSchemaNull(schema) ||
      this.convertSchemaEnum(schema) ||
      this.convertExplicitSchema(schema) ||
      this.convertStringSchema(schema) ||
      this.convertNumberSchema(schema) ||
      this.convertBooleanSchema(schema) ||
      this.convertResolveRefSchema(schema) ||
      this.convertRefSchema(schema) ||
      this.convertMaybeArrayOfSchema(schema) ||
      this.convertArrayOfSchema(schema) ||
      this.convertAllOfSchema(schema) ||
      this.convertAnyOfSchema(schema) ||
      this.convertRecordSchema(schema) ||
      this.convertObjectSchema(schema);
    if (result) {
      return result;
    }

    throw new Error(
      `Unsupported schema: ${JSON.stringify(schema, null, 2)}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  convertSchemaEnum(schema: any): string | undefined {
    // deno-lint-ignore no-explicit-any
    const zodEnumDeclaration = (values: any[]) => {
      // first filter out strings
      const zodEnumStrings = values.filter((value) => {
        return typeof value === "string";
      }).map((value) => {
        return JSON.stringify(value);
      });
      const zodLiterals = values.filter((x) => {
        return typeof x !== "string";
      });
      const zodTypes: string[] = [];

      if (zodEnumStrings.length) {
        zodTypes.push(
          `z.enum([${zodEnumStrings.join(", ")}] as const)`,
        );
      }
      if (zodLiterals.length) {
        zodTypes.push(
          ...zodLiterals.map((x) => {
            return `z.literal(${JSON.stringify(x)})`;
          }),
        );
      }
      if (zodTypes.length === 0) {
        throw new Error(
          `Unimplemented: ${JSON.stringify(schema, null, 2)}`,
        );
      } else if (zodTypes.length === 1) {
        return zodTypes[0];
      } else {
        return `z.union([${zodTypes.join(", ")}])`;
      }
    };
    if (schema.enum) {
      if (Array.isArray(schema.enum)) {
        return zodEnumDeclaration(schema.enum);
      }
      return this.convertSchemaEnum(schema.enum);
    }
    if (schema.values) {
      return zodEnumDeclaration(schema.values);
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertSchemaNull(schema: any): string | undefined {
    if (schema === "null" || schema === null || schema.null) {
      return `z.null()`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertExplicitSchema(schema: any): string | undefined {
    if (schema.schema) {
      return this.convertToZodJsSource(schema.schema);
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertStringSchema(schema: any): string | undefined {
    // SchemaExplicitPatternString
    // SchemaString
    if (schema === "string") {
      return `z.string()`;
    }
    if (schema === "path") {
      return `z.string()`;
    }
    // deno-lint-ignore no-explicit-any
    const zodDeclStringWithMaybePattern = (innerSchema: any) => {
      if (innerSchema.pattern) {
        return `z.string().regex(new RegExp(${
          JSON.stringify(
            innerSchema.pattern,
          )
        }))`;
      } else {
        return `z.string()`;
      }
    };
    if (schema.path) {
      return zodDeclStringWithMaybePattern(schema.path);
    }
    if (schema.string) {
      return zodDeclStringWithMaybePattern(schema.string);
    }
    if (schema.pattern) {
      return zodDeclStringWithMaybePattern(schema);
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertNumberSchema(schema: any): string | undefined {
    if (schema === "number") {
      return `z.number()`;
    }
    if (schema.number) {
      return `z.number()`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertBooleanSchema(schema: any): string | undefined {
    if (schema === "boolean") {
      return `z.boolean()`;
    }
    if (schema.boolean) {
      return `z.boolean()`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertResolveRefSchema(schema: any): string | undefined {
    if (schema.resolveRef) {
      throw new Error("Unimplemented: convertResolveRefSchema");
    }
    return undefined;
  }

  // TODO: if this is a recursive schema, we need to know about that
  // and change the top-level schema to have an explicit type annotation
  // cf https://zod.dev/?id=recursive-types
  // deno-lint-ignore no-explicit-any
  convertRefSchema(schema: any): string | undefined {
    if (schema.ref) {
      const refName = typeNameFromSchemaName(schema.ref);
      return `z.lazy(() => Zod${refName})`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertMaybeArrayOfSchema(schema: any): string | undefined {
    if (schema.maybeArrayOf) {
      const innerSchema = schema.maybeArrayOf;
      const innerZodType = this.convertToZodJsSource(innerSchema);
      return `z.union([${innerZodType}, z.array(${innerZodType})])`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertArrayOfSchema(schema: any): string | undefined {
    if (schema.arrayOf) {
      const innerSchema = schema.arrayOf;
      const innerZodType = this.convertToZodJsSource(innerSchema);
      return `z.array(${innerZodType})`;
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  convertAllOfSchema(schema: any): string | undefined {
    if (!schema.allOf) {
      return undefined;
    }
    const innerSchemas = schema.allOf;
    // deno-lint-ignore no-explicit-any
    const innerZodTypes = innerSchemas.map((s: any) => {
      return this.convertToZodJsSource(s);
    });
    let first = innerZodTypes.shift();
    // z.intersection doesn't take more than 2 arguments
    // so we need to chain sese together
    while (innerZodTypes.length > 0) {
      const innerZodType = innerZodTypes.shift();
      first = `${first}.and(${innerZodType})`;
    }
    return first;
  }

  // deno-lint-ignore no-explicit-any
  convertAnyOfSchema(schema: any): string | undefined {
    if (!schema.anyOf) {
      return undefined;
    }
    const innerSchemas = schema.anyOf;
    // deno-lint-ignore no-explicit-any
    const innerZodTypes = innerSchemas.map((s: any) => {
      return this.convertToZodJsSource(s);
    });
    return `z.union([${innerZodTypes.join(", ")}])`;
  }

  // deno-lint-ignore no-explicit-any
  convertRecordSchema(schema: any): string | undefined {
    if (!schema.record) {
      return undefined;
    }
    const properties = schema.record.properties || schema.record;
    return `z.object({ ${
      Object.entries(properties).map(([key, value]) => {
        return `${yamlToTypeScriptKey(key)}: ${
          this.convertToZodJsSource(value)
        }`;
      })
    }}).strict()`;
  }

  // deno-lint-ignore no-explicit-any
  convertObjectSchema(schema: any): string | undefined {
    // deno-lint-ignore no-explicit-any
    const getProperties = (s: any) => {
      if (s.properties) {
        return s.properties;
      }
      if (s.schema) {
        return getProperties(s.schema);
      }
      if (s.object) {
        return getProperties(s.object);
      }
      return {};
    };
    // deno-lint-ignore no-explicit-any
    const resolveSuper = (s: any) => {
      if (!s.super) {
        return s;
      }
      // deno-lint-ignore no-explicit-any
      let superSchemas: any[];
      if (Array.isArray(s.super)) {
        superSchemas = s.super.map(resolveSuper);
      } else if (s.super.resolveRef) {
        superSchemas = [
          this.schemas[typeNameFromSchemaName(s.super.resolveRef)],
        ];
      } else {
        throw new Error(
          `Unimplemented: ${JSON.stringify(s.super, null, 2)}`,
        );
      }
      // deno-lint-ignore no-explicit-any
      const properties: Record<string, any> = {};
      for (const superSchema of superSchemas) {
        const superProperties = getProperties(superSchema);
        for (const key in superProperties) {
          properties[key] = superProperties[key];
        }
      }

      return {
        ...s,
        properties: {
          ...properties,
          ...getProperties(s),
        },
      };
    };
    if (schema === "object") {
      return `z.object({}).passthrough()`;
    }
    if (!schema.object) {
      return undefined;
    }
    let obj = schema.object;
    if (obj.namingConvention) {
      console.warn(
        "namingConvention enforcement is not supported. Ignoring.",
      );
      console.warn(JSON.stringify(obj, null, 2));
    }
    const closed = obj.closed || false;
    const required = obj.required;
    obj = resolveSuper(obj);
    let baseObj = `z.object({${
      Object.entries(obj.properties || {}).map(([key, value]) => {
        return `${yamlToTypeScriptKey(key)}: ${
          this.convertToZodJsSource(value)
        }`;
      }).join(", ")
    }})`;
    if (closed) {
      baseObj = `${baseObj}.strict()`;
    } else {
      baseObj = `${baseObj}.passthrough()`;
    }
    if (Array.isArray(required)) {
      baseObj = `${baseObj}.partial().required({${
        required.map((key: string) => {
          return `${key}: true`;
        }).join(", ")
      }})`;
    } else if (required === undefined) {
      baseObj = `${baseObj}.partial()`;
    } else if (required === "all") {
      baseObj = `${baseObj}.required()`;
    }
    if (obj.additionalProperties) {
      baseObj = `z.record(${
        this.convertToZodJsSource(
          obj.additionalProperties,
        )
      }).and(${baseObj})`;
    }

    return baseObj;
  }
}

export async function generateZodTypesFromSchemas(resourcePath: string) {
  const builder = new ZodDeclarationFileBuilder();
  const schemas = schemaDefinitions(resourcePath);

  const schemasToSkip = [
    "SidebarContents",
    "NavigationItem",
    "NavigationItemObject",
  ];

  for (const schema of schemas) {
    builder.addSchema(schema, schemasToSkip.includes(schema.name));
  }
  const zodTypes = builder.fileSource();
  const schemaSchemaSourcePath = join(
    resourcePath,
    "types",
    "zod",
    "schema-types.ts",
  );
  ensureDirSync(join(
    resourcePath,
    "types",
    "zod",
  ));
  Deno.writeTextFileSync(
    schemaSchemaSourcePath,
    zodTypes,
  );
  await fmtSource(schemaSchemaSourcePath);
}
