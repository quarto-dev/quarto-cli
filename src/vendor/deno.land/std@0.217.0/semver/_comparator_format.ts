// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator } from "./types.ts";
import { format } from "./format.ts";

/**
 * Formats the comparator into a string
 * @example >=0.0.0
 * @param comparator
 * @returns A string representation of the comparator
 */
export function comparatorFormat(comparator: Comparator): string {
  const { semver, operator } = comparator;
  return `${operator === undefined ? "" : operator}${
    format(semver ?? comparator)
  }`;
}
