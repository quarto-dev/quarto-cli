// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns true if the given value is part of the given object, otherwise it
 * returns false.
 *
 * Note: this doesn't work with non-primitive values. For example,
 * `includesValue({x: {}}, {})` returns false.
 *
 * @template T The type of the values in the input record.
 *
 * @param record The record to check for the given value.
 * @param value The value to check for in the record.
 *
 * @returns `true` if the value is part of the record, otherwise `false`.
 *
 * @example Basic usage
 * ```ts
 * import { includesValue } from "@std/collections/includes-value";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const input = {
 *   first: 33,
 *   second: 34,
 * };
 *
 * assertEquals(includesValue(input, 34), true);
 * ```
 */
export function includesValue<T>(
  record: Readonly<Record<string, T>>,
  value: T,
): boolean {
  for (const i in record) {
    if (
      Object.hasOwn(record, i) &&
      (record[i] === value || Number.isNaN(value) && Number.isNaN(record[i]))
    ) {
      return true;
    }
  }

  return false;
}
