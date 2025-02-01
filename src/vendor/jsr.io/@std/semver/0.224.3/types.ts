// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

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
 */
export type Operator =
  | undefined
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<=";

/**
 * The shape of a valid semantic version comparator
 * @example >=0.0.0
 */
export interface Comparator extends SemVer {
  /** The operator */
  operator?: Operator;
}

/**
 * A SemVer object parsed into its constituent parts.
 */
export interface SemVer {
  /** The major version */
  major: number;
  /** The minor version */
  minor: number;
  /** The patch version */
  patch: number;
  /** The prerelease version */
  prerelease?: (string | number)[];
  /** The build metadata */
  build?: string[];
}

/**
 * A type representing a semantic version range. The ranges consist of
 * a nested array, which represents a set of OR comparisons while the
 * inner array represents AND comparisons.
 */
export type Range = Comparator[][];
