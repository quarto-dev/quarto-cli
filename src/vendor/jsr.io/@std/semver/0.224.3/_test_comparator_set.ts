// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { Comparator, SemVer } from "./types.ts";
import { isWildcardComparator } from "./_shared.ts";
import { compare } from "./compare.ts";

function testComparator(version: SemVer, comparator: Comparator): boolean {
  if (isWildcardComparator(comparator)) {
    return true;
  }
  const cmp = compare(version, comparator);
  switch (comparator.operator) {
    case "=":
    case undefined: {
      return cmp === 0;
    }
    case "!=": {
      return cmp !== 0;
    }
    case ">": {
      return cmp > 0;
    }
    case "<": {
      return cmp < 0;
    }
    case ">=": {
      return cmp >= 0;
    }
    case "<=": {
      return cmp <= 0;
    }
  }
}

export function testComparatorSet(
  version: SemVer,
  set: Comparator[],
): boolean {
  for (const comparator of set) {
    if (!testComparator(version, comparator)) {
      return false;
    }
  }
  if (version.prerelease && version.prerelease.length > 0) {
    // Find the comparator that is allowed to have prereleases
    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
    // That should allow `1.2.3-pr.2` to pass.
    // However, `1.2.4-alpha.notready` should NOT be allowed,
    // even though it's within the range set by the comparators.
    for (const comparator of set) {
      if (isWildcardComparator(comparator)) {
        continue;
      }
      const { major, minor, patch, prerelease } = comparator;
      if (prerelease && prerelease.length > 0) {
        if (
          version.major === major && version.minor === minor &&
          version.patch === patch
        ) {
          return true;
        }
      }
    }
    return false;
  }
  return true;
}
