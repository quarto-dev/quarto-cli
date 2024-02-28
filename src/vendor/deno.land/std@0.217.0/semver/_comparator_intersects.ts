// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator } from "./types.ts";
import { compare } from "./compare.ts";
import { testRange } from "./test_range.ts";
import { isWildcardComparator } from "./_shared.ts";

/**
 * Returns true if the range of possible versions intersects with the other comparators set of possible versions
 * @param c0 The left side comparator
 * @param c1 The right side comparator
 * @returns True if any part of the comparators intersect
 */
export function comparatorIntersects(
  c0: Comparator,
  c1: Comparator,
): boolean {
  const op0 = c0.operator;
  const op1 = c1.operator;

  if (op0 === "" || op0 === undefined) {
    // if c0 is empty comparator, then returns true
    if (isWildcardComparator(c0)) {
      return true;
    }
    return testRange(c0, [[c1]]);
  } else if (op1 === "" || op1 === undefined) {
    if (isWildcardComparator(c1)) {
      return true;
    }
    return testRange(c1, [[c0]]);
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
