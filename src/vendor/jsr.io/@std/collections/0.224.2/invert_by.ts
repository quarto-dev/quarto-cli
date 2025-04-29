// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Return type for {@linkcode invertBy}. */
export type InvertByResult<
  T extends Record<PropertyKey, PropertyKey>,
  K extends keyof T,
> = Record<PropertyKey, K[]>;

/**
 * Composes a new record with all keys and values inverted.
 *
 * The new record is generated from the result of running each element of the
 * input record through the given transformer function.
 *
 * The corresponding inverted value of each inverted key is an array of keys
 * responsible for generating the inverted value.
 *
 * @template R The type of the input record.
 * @template T The type of the iterator function.
 *
 * @param record The record to invert.
 * @param transformer The function to transform keys.
 *
 * @returns A new record with all keys and values inverted.
 *
 * @example Basic usage
 * ```ts
 * import { invertBy } from "@std/collections/invert-by";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const record = { a: "x", b: "y", c: "z" };
 *
 * assertEquals(
 *   invertBy(record, (key) => String(key).toUpperCase()),
 *   { X: ["a"], Y: ["b"], Z: ["c"] }
 * );
 * ```
 */
export function invertBy<
  R extends Record<PropertyKey, PropertyKey>,
  T extends (key: PropertyKey) => PropertyKey,
>(record: Readonly<R>, transformer: T): InvertByResult<R, keyof R> {
  const result = {} as InvertByResult<R, keyof R>;

  for (const [key, value] of Object.entries(record)) {
    const mappedKey = transformer(value);
    if (!Object.hasOwn(result, mappedKey)) {
      result[mappedKey] = [key];
    } else {
      result[mappedKey]!.push(key);
    }
  }

  return result;
}
