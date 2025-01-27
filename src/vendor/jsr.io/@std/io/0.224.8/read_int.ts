// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { BufReader } from "./buf_reader.ts";
import { readShort } from "./read_short.ts";

/**
 * Read big endian 32bit integer from a {@linkcode BufReader}.
 *
 * @example Usage
 * ```ts
 * import { Buffer } from "@std/io/buffer"
 * import { BufReader } from "@std/io/buf-reader";
 * import { readInt } from "@std/io/read-int";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const buf = new BufReader(new Buffer(new Uint8Array([0x12, 0x34, 0x56, 0x78])));
 * const int = await readInt(buf);
 * assertEquals(int, 0x12345678);
 * ```
 *
 * @param buf The buffer reader to read from
 * @returns The 32bit integer
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function readInt(buf: BufReader): Promise<number | null> {
  const high = await readShort(buf);
  if (high === null) return null;
  const low = await readShort(buf);
  if (low === null) throw new Deno.errors.UnexpectedEof();
  return (high << 16) | low;
}
