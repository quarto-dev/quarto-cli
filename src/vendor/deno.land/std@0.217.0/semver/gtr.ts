// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer } from "./types.ts";
import { rangeMax } from "./range_max.ts";
import { greaterThan } from "./greater_than.ts";

/**
 * Checks to see if the version is greater than all possible versions of the range.
 * @deprecated (will be removed after 0.217.0) See
 * {@link https://github.com/denoland/deno_std/issues/4273 | deno_std#4273}
 * for details.
 */
export function gtr(
  version: SemVer,
  range: Range,
): boolean {
  return greaterThan(version, rangeMax(range));
}
