// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Closer } from "./types.ts";

export function isCloser(value: unknown): value is Closer {
  return typeof value === "object" && value !== null && value !== undefined &&
    "close" in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as Record<string, any>)["close"] === "function";
}
