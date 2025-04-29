// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Return type for {@linkcode invert}. */
export type InvertResult<T extends Record<PropertyKey, PropertyKey>> = {
  [P in keyof T as T[P]]: P;
};

/**
 * Composes a new record with all keys and values inverted.
 *
 * If the record contains duplicate values, subsequent values overwrite property
 * assignments of previous values. If the record contains values which aren't
 * {@linkcode PropertyKey}s their string representation is used as the key.
 *
 * @template T The type of the input record.
 *
 * @param record The record to invert.
 *
 * @returns A new record with all keys and values inverted.
 *
 * @example Basic usage
 * ```ts
 * import { invert } from "@std/collections/invert";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const record = { a: "x", b: "y", c: "z" };
 *
 * assertEquals(invert(record), { x: "a", y: "b", z: "c" });
 * ```
 */
export function invert<T extends Record<PropertyKey, PropertyKey>>(
  record: Readonly<T>,
): InvertResult<T> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [value, key]),
  );
}
