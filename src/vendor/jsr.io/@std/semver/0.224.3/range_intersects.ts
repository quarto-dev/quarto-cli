// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { isWildcardComparator } from "./_shared.ts";
import { compare } from "./compare.ts";
import { satisfies } from "./satisfies.ts";
import type { Comparator, Range } from "./types.ts";

function comparatorIntersects(
  c0: Comparator,
  c1: Comparator,
): boolean {
  const op0 = c0.operator;
  const op1 = c1.operator;

  if (op0 === undefined) {
    // if c0 is empty comparator, then returns true
    if (isWildcardComparator(c0)) return true;
    return satisfies(c0, [[c1]]);
  }
  if (op1 === undefined) {
    if (isWildcardComparator(c1)) return true;
    return satisfies(c1, [[c0]]);
  }

  const cmp = compare(c0, c1);

  const sameDirectionIncreasing = (op0 === ">=" || op0 === ">") &&
    (op1 === ">=" || op1 === ">");
  const sameDirectionDecreasing = (op0 === "<=" || op0 === "<") &&
    (op1 === "<=" || op1 === "<");
  const sameSemVer = cmp === 0;
  const differentDirectionsInclusive = (op0 === ">=" || op0 === "<=") &&
    (op1 === ">=" || op1 === "<=");
  const oppositeDirectionsLessThan = cmp === -1 &&
    (op0 === ">=" || op0 === ">") &&
    (op1 === "<=" || op1 === "<");
  const oppositeDirectionsGreaterThan = cmp === 1 &&
    (op0 === "<=" || op0 === "<") &&
    (op1 === ">=" || op1 === ">");

  return sameDirectionIncreasing ||
    sameDirectionDecreasing ||
    (sameSemVer && differentDirectionsInclusive) ||
    oppositeDirectionsLessThan ||
    oppositeDirectionsGreaterThan;
}

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
 *
 * @example Usage
 * ```ts
 * import { parseRange, rangeIntersects } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const r0 = parseRange(">=1.0.0 <2.0.0");
 * const r1 = parseRange(">=1.0.0 <1.2.3");
 * const r2 = parseRange(">=1.2.3 <2.0.0");
 *
 * assert(rangeIntersects(r0, r1));
 * assert(rangeIntersects(r0, r2));
 * assertFalse(rangeIntersects(r1, r2));
 * ```
 *
 * @param r0 range 0
 * @param r1 range 1
 * @returns returns true if the given ranges intersect, false otherwise
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
