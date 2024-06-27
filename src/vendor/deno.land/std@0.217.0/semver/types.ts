// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { OPERATORS } from "./_constants.ts";

/**
 * The possible release types are used as an operator for the
 * increment function and as a result of the difference function.
 */
export type ReleaseType =
  | "pre"
  | "major"
  | "premajor"
  | "minor"
  | "preminor"
  | "patch"
  | "prepatch"
  | "prerelease";

/**
 * SemVer comparison operators.
 * @deprecated (will be removed in 0.219.0) `"=="`, `"==="`, `"!=="` and `""` operators are deprecated. Use `"="`, `"!="` or `undefined` instead.
 */
export type Operator = typeof OPERATORS[number];

/**
 * The shape of a valid semantic version comparator
 * @example >=0.0.0
 */
export interface Comparator extends SemVer {
  operator?: Operator;
  /**
   * @deprecated (will be removed after 0.217.0) {@linkcode Comparator} extends {@linkcode SemVer}. Use `major`, `minor`, `patch`, `prerelease`, and `build` properties instead.
   */
  semver?: SemVer;
}

/**
 * A SemVer object parsed into its constituent parts.
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: (string | number)[];
  build?: string[];
}

/**
 * A type representing a semantic version range. The ranges consist of
 * a nested array, which represents a set of OR comparisons while the
 * inner array represents AND comparisons.
 */
export type Range = Comparator[][];
