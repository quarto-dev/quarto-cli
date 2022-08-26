// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/**
 * Utilities for working with Deno's readers, writers, and web streams.
 *
 * `Reader` and `Writer` interfaces are deprecated in Deno, and so many of these
 * utilities are also deprecated. Consider using web streams instead.
 *
 * @module
 */

export * from "./buffer.ts";
export * from "./readers.ts";
export * from "./streams.ts";
export {
  copyN,
  readInt,
  readLong,
  readShort,
  sliceLongToBytes,
} from "./util.ts";
export * from "./writers.ts";
