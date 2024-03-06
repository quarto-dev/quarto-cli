// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { SemVer } from "./types.ts";
import { compare } from "./compare.ts";

/**
 * Sorts a list of semantic versions in descending order.
 * @deprecated (will be removed after 0.217.0) Use `versions.sort((a, b) => compare(b, a))` instead.
 */
export function reverseSort(
  versions: SemVer[],
): SemVer[] {
  return versions.sort((a, b) => compare(b, a));
}
