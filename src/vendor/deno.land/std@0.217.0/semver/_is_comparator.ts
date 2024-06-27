// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { isSemVer } from "./is_semver.ts";
import { OPERATORS } from "./_constants.ts";
import type { Comparator } from "./types.ts";
import { ALL, NONE } from "./constants.ts";

/**
 * Does a deep check on the value to see if it is a valid Comparator object.
 *
 * Objects with extra fields are still considered valid if they have at
 * least the correct fields.
 *
 * Adds a type assertion if true.
 * @param value The value to check if its a Comparator
 * @returns True if the object is a Comparator otherwise false
 */
export function isComparator(value: unknown): value is Comparator {
  if (
    value === null || value === undefined || Array.isArray(value) ||
    typeof value !== "object"
  ) return false;
  if (value === NONE || value === ALL) return true;
  const { operator, semver } = value as Comparator;
  return (
    (operator === undefined ||
      OPERATORS.includes(operator)) &&
    isSemVer(semver)
  );
}
