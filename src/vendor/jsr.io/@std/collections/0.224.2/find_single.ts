// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns an element if and only if that element is the only one matching the
 * given condition. Returns `undefined` otherwise.
 *
 * @template T The type of the elements in the input array.
 *
 * @param array The array to find a single element in.
 * @param predicate The function to test each element for a condition.
 *
 * @returns The single element that matches the given condition or `undefined`
 * if there are zero or more than one matching elements.
 *
 * @example Basic usage
 * ```ts
 * import { findSingle } from "@std/collections/find-single";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const bookings = [
 *   { month: "January", active: false },
 *   { month: "March", active: false },
 *   { month: "June", active: true },
 * ];
 * const activeBooking = findSingle(bookings, (booking) => booking.active);
 * const inactiveBooking = findSingle(bookings, (booking) => !booking.active);
 *
 * assertEquals(activeBooking, { month: "June", active: true });
 * assertEquals(inactiveBooking, undefined); // There are two applicable items
 * ```
 */
export function findSingle<T>(
  array: Iterable<T>,
  predicate: (el: T) => boolean,
): T | undefined {
  let match: T | undefined;
  let found = false;
  for (const element of array) {
    if (predicate(element)) {
      if (found) return undefined;
      found = true;
      match = element;
    }
  }

  return match;
}
