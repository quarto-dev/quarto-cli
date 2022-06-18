// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * IO
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
