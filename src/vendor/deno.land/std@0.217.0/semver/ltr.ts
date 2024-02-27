// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer } from "./types.ts";
import { lessThan } from "./less_than.ts";
import { rangeMin } from "./range_min.ts";

/**
 *  Less than range comparison
 * @deprecated (will be removed after 0.217.0) See
 * {@link https://github.com/denoland/deno_std/issues/4273 | deno_std#4273}
 * for details.
 */
export function ltr(
  version: SemVer,
  range: Range,
): boolean {
  return lessThan(version, rangeMin(range));
}
