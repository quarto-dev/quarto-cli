/*
 * dynamic.ts
 *
 * Tools for managing the interface between dynamic and static typing
 * in Quarto.
 *
 * Ideally, every usage of `any` or `as` would appear in this file.
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { DynamicTypeCheckError } from "../core/lib/error.ts";

export const makeStringEnumTypeFunctions = <T extends string>(
  ...values: T[]
): {
  predicate: (value: unknown) => value is T;
  enforce: (value: unknown) => T;
} => {
  const valueSet: Set<string> = new Set(values);
  const predicate = (value: unknown): value is T => {
    return typeof value === "string" && valueSet.has(value);
  };
  const enforce = (value: unknown): T => {
    if (predicate(value)) {
      return value;
    }
    throw new DynamicTypeCheckError(
      "Invalid value '" + value + "' (valid values are " +
        values.join(", ") + ").",
    );
  };
  return { predicate, enforce };
};

export const makeStringEnumTypeEnforcer = <T extends string>(
  ...values: T[]
): (value: unknown) => T => {
  return makeStringEnumTypeFunctions(...values).enforce;
};

export const enforcer = <T>(
  predicate: (value: unknown) => value is T,
  msg?: (value: unknown) => string,
) => {
  if (!msg) {
    msg = (_value: unknown) => "Invalid value.";
  }
  return (value: unknown): T => {
    if (predicate(value)) {
      return value;
    }
    throw new DynamicTypeCheckError(msg(value));
  };
};

export const enforceStringType = (value: unknown): string => {
  if (stringTypePredicate(value)) {
    return value;
  }
  throw new DynamicTypeCheckError("Expected a string.");
};

export const stringTypePredicate = (value: unknown): value is string => {
  return typeof value === "string";
};

export const objectPredicate = (
  value: unknown,
): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};
