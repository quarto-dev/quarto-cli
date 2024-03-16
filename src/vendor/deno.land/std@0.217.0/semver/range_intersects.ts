// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { comparatorIntersects } from "./_comparator_intersects.ts";
import type { Comparator, Range } from "./types.ts";

function rangesSatisfiable(ranges: Range[]): boolean {
  return ranges.every((r) => {
    // For each OR at least one AND must be satisfiable
    return r.some((comparators) => comparatorsSatisfiable(comparators));
  });
}

function comparatorsSatisfiable(comparators: Comparator[]): boolean {
  // Comparators are satisfiable if they all intersect with each other
  for (let i = 0; i < comparators.length - 1; i++) {
    const c0 = comparators[i]!;
    for (const c1 of comparators.slice(i + 1)) {
      if (!comparatorIntersects(c0, c1)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The ranges intersect every range of AND comparators intersects with a least one range of OR ranges.
 * @param r0 range 0
 * @param r1 range 1
 * @returns returns true if any
 */
export function rangeIntersects(
  r0: Range,
  r1: Range,
): boolean {
  return rangesSatisfiable([r0, r1]) &&
    r0.some((r00) => {
      return r1.some((r11) => {
        return r00.every((c0) => {
          return r11.every((c1) => comparatorIntersects(c0, c1));
        });
      });
    });
}
