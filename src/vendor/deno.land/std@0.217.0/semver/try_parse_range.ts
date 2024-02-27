// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { Range } from "./types.ts";
import { parseRange } from "./parse_range.ts";

/**
 * A tries to parse a valid Range string or returns undefined
 * @param range The range string
 * @returns A Range object if valid otherwise `undefined`
 */
export function tryParseRange(
  range: string,
): Range | undefined {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return parseRange(range);
  } catch {
    return undefined;
  }
}
