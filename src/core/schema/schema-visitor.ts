/*
 * schema-visitor.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import * as T from "../../resources/types/schema-schema-types.ts";

type Maybe<Result> = Result | undefined;
type ObjectResult<Result> = {
  properties?: { [key: string]: Maybe<Result> };
  patternProperties?: { [key: string]: Maybe<Result> };
  additionalProperties?: Maybe<Result>;
};
type RecordResult<Result> = {
  properties?: { [key: string]: Maybe<Result> };
};
type SchemaVisitor<Result> = {
  visitEnum?: (schema: T.SchemaEnum) => Maybe<Result>;
  visitNull?: (schema: T.SchemaNull) => Maybe<Result>;
  visitString?: (schema: T.SchemaString) => Maybe<Result>;
  visitNumber?: (schema: T.SchemaNumber) => Maybe<Result>;
  visitBoolean?: (schema: T.SchemaBoolean) => Maybe<Result>;
  visitResolveRef?: (schema: T.SchemaResolveRef) => Maybe<Result>;
  visitRef?: (schema: T.SchemaRef) => Maybe<Result>;
  visitMaybeArrayOf?: (
    schema: T.SchemaMaybeArrayOf,
    v: Maybe<Result>,
  ) => Maybe<Result>;
  visitArrayOf?: (schema: T.SchemaArrayOf, v: Maybe<Result>) => Maybe<Result>;
  visitAllOf?: (schema: T.SchemaAllOf, v: Maybe<Result>[]) => Maybe<Result>;
  visitAnyOf?: (schema: T.SchemaAnyOf, v: Maybe<Result>[]) => Maybe<Result>;
  visitObject?: (
    schema: T.SchemaObject,
    v: ObjectResult<Result>,
  ) => Maybe<Result>;
  visitRecord?: (
    schema: T.SchemaRecord,
    v: RecordResult<Result>,
  ) => Maybe<Result>;
  visitAny?: (schema: "any") => Maybe<Result>;
  visit?: (
    schema: T.SchemaSchema,
    v?: Result | Result[] | ObjectResult<Result> | RecordResult<Result>,
  ) => Maybe<Result>;
};

export const schemaVisitor = <Result>(
  visitor: SchemaVisitor<Result>,
) => {
  const visit = (schema: T.SchemaSchema): Result | undefined => {
    if (schema === null || schema === "null") {
      return (visitor.visitNull ?? visitor.visit)?.(schema);
    } else if (schema === "string" || schema === "path") {
      return (visitor.visitString ?? visitor.visit)?.(schema);
    } else if (schema === "number") {
      return (visitor.visitNumber ?? visitor.visit)?.(schema);
    } else if (schema === "boolean") {
      return (visitor.visitBoolean ?? visitor.visit)?.(schema);
    } else if (schema === "object") {
      return (visitor.visitObject ?? visitor.visit)?.(schema, {});
    } else if (schema === "any") {
      return (visitor.visitAny ?? visitor.visit)?.(schema);
    } else {
      const s: { [key: string]: unknown } = schema;
      if (s.enum) {
        return (visitor.visitEnum ?? visitor.visit)?.(schema as T.SchemaEnum);
      } else if (s.null) {
        return (visitor.visitNull ?? visitor.visit)?.(schema as T.SchemaNull);
      } else if (s.schema) {
        return visit(s.schema as T.SchemaSchema);
      } else if (s.string || s.path) {
        return (visitor.visitString ?? visitor.visit)?.(
          schema as T.SchemaString,
        );
      } else if (s.number) {
        return (visitor.visitNumber ?? visitor.visit)?.(
          schema as T.SchemaNumber,
        );
      } else if (s.boolean) {
        return (visitor.visitBoolean ?? visitor.visit)?.(
          schema as T.SchemaBoolean,
        );
      } else if (s.resolveRef) {
        return (visitor.visitResolveRef ?? visitor.visit)?.(
          schema as T.SchemaResolveRef,
        );
      } else if (s.ref) {
        return (visitor.visitRef ?? visitor.visit)?.(schema as T.SchemaRef);
      } else if (s.maybeArrayOf) {
        const inner = visit(s.maybeArrayOf as T.SchemaSchema);
        return (visitor.visitMaybeArrayOf ?? visitor.visit)?.(
          schema as T.SchemaMaybeArrayOf,
          inner,
        );
      } else if (s.arrayOf) {
        const inner = visit(s.arrayOf as T.SchemaSchema);
        return (visitor.visitArrayOf ?? visitor.visit)?.(
          schema as T.SchemaArrayOf,
          inner,
        );
      } else if (s.allOf) {
        const allOf = (s.allOf ?? s.schemas) as T.SchemaSchema[];
        const inner = allOf.map((s) => visit(s));
        return (visitor.visitAllOf ?? visitor.visit)?.(
          schema as T.SchemaAllOf,
          inner,
        );
      } else if (s.anyOf) {
        const anyOf = s.anyOf as T.SchemaSchema[];
        const inner = anyOf.map((s) => visit(s));
        return (visitor.visitAnyOf ?? visitor.visit)?.(
          schema as T.SchemaAnyOf,
          inner,
        );
      } else if (s.object) {
        const inner: ObjectResult<Result> = {};
        const object = s.object as T.SchemaExplicitObject["object"];
        // now recurse into object properties
        if (object?.additionalProperties) {
          inner.additionalProperties = visit(
            object?.additionalProperties as T.SchemaSchema,
          );
          visit(object?.additionalProperties as T.SchemaSchema);
        }
        if (object?.properties) {
          const properties = object.properties;
          inner.properties = {};
          for (const key in properties) {
            inner.properties[key] = visit(properties[key]);
          }
        }
        if (object?.patternProperties) {
          const patternProperties = object.patternProperties;
          inner.patternProperties = {};
          for (const key in patternProperties) {
            inner.patternProperties[key] = visit(patternProperties[key]);
          }
        }
        return (visitor.visitObject ?? visitor.visit)?.(
          schema as T.SchemaObject,
          inner,
        );
      } else if (s.record) {
        const inner: RecordResult<Result> = {};
        const record = s.record as any;
        inner.properties = {};
        if (record.properties) {
          // explicit properties
          const properties = record.properties as {
            [key: string]: T.SchemaSchema;
          };
          for (const key in properties) {
            inner.properties[key] = visit(properties[key]);
          }
        } else {
          // implicit properties
          const properties = record as { [key: string]: T.SchemaSchema };
          for (const key in properties) {
            inner.properties[key] = visit(properties[key]);
          }
        }
        return (visitor.visitRecord ?? visitor.visit)?.(
          schema as T.SchemaRecord,
          inner,
        );
      } else {
        throw new Error(`Unimplemented: ${JSON.stringify(schema)}`);
      }
    }
  };
  return visit;
};
