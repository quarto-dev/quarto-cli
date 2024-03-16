// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator, SemVer } from "./types.ts";

/**
 * MAX is a sentinel value used by some range calculations.
 * It is equivalent to `∞.∞.∞`.
 */
export const MAX: SemVer = {
  major: Number.POSITIVE_INFINITY,
  minor: Number.POSITIVE_INFINITY,
  patch: Number.POSITIVE_INFINITY,
  prerelease: [],
  build: [],
};

/**
 * The minimum valid SemVer object. Equivalent to `0.0.0`.
 */
export const MIN: SemVer = {
  major: 0,
  minor: 0,
  patch: 0,
  prerelease: [],
  build: [],
};

/**
 * A sentinel value used to denote an invalid SemVer object
 * which may be the result of impossible ranges or comparator operations.
 * @example
 * ```ts
 * import { equals } from "https://deno.land/std@$STD_VERSION/semver/equals.ts";
 * import { parse } from "https://deno.land/std@$STD_VERSION/semver/parse.ts";
 * import { INVALID } from "https://deno.land/std@$STD_VERSION/semver/constants.ts"
 * equals(parse("1.2.3"), INVALID);
 * ```
 */
export const INVALID: SemVer = {
  major: Number.NEGATIVE_INFINITY,
  minor: Number.POSITIVE_INFINITY,
  patch: Number.POSITIVE_INFINITY,
  prerelease: [],
  build: [],
};

/**
 * ANY is a sentinel value used by some range calculations. It is not a valid
 * SemVer object and should not be used directly.
 * @example
 * ```ts
 * import { equals } from "https://deno.land/std@$STD_VERSION/semver/equals.ts";
 * import { parse } from "https://deno.land/std@$STD_VERSION/semver/parse.ts";
 * import { ANY } from "https://deno.land/std@$STD_VERSION/semver/constants.ts"
 * equals(parse("1.2.3"), ANY); // false
 * ```
 */
export const ANY: SemVer = {
  major: Number.NaN,
  minor: Number.NaN,
  patch: Number.NaN,
  prerelease: [],
  build: [],
};

/**
 * A comparator which will span all valid semantic versions
 */
export const ALL: Comparator = {
  operator: "",
  ...ANY,
  semver: ANY,
};

/**
 * A comparator which will not span any semantic versions
 */
export const NONE: Comparator = {
  operator: "<",
  ...MIN,
  semver: MIN,
};
