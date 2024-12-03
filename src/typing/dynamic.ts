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

export const checkStringEnum = <T extends string>(
  ...values: T[]
): (value: string) => T => {
  const valueSet: Set<string> = new Set(values);
  return (value: string): T => {
    if (!valueSet.has(value)) {
      throw new DynamicTypeCheckError(
        "Invalid value '" + value + "' (valid values are " +
          values.join(", ") + ").",
      );
    }
    return value as unknown as T;
  };
};
