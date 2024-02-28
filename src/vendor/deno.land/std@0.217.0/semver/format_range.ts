// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range } from "./types.ts";
import { comparatorFormat } from "./_comparator_format.ts";

/**
 * Formats the range into a string
 * @example >=0.0.0 || <1.0.0
 * @param range The range to format
 * @returns A string representation of the range
 */
export function formatRange(range: Range): string {
  return range.map((c) => c.map((c) => comparatorFormat(c)).join(" "))
    .join("||");
}
