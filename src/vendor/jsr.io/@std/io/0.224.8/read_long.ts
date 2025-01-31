// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { BufReader } from "./buf_reader.ts";
import { readInt } from "./read_int.ts";

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Read big endian 64bit long from a {@linkcode BufReader}.
 *
 * @example Usage
 * ```ts
 * import { Buffer } from "@std/io/buffer"
 * import { BufReader } from "@std/io/buf-reader";
 * import { readLong } from "@std/io/read-long";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const buf = new BufReader(new Buffer(new Uint8Array([0, 0, 0, 0x12, 0x34, 0x56, 0x78, 0x9a])));
 * const long = await readLong(buf);
 * assertEquals(long, 0x123456789a);
 * ```
 *
 * @param buf The BufReader to read from
 * @returns The 64bit long
 * @throws {Deno.errors.UnexpectedEof} If the reader returns unexpected EOF
 * @throws {RangeError} If the long value is too big to be represented as a JavaScript number
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function readLong(buf: BufReader): Promise<number | null> {
  const high = await readInt(buf);
  if (high === null) return null;
  const low = await readInt(buf);
  if (low === null) throw new Deno.errors.UnexpectedEof();
  const big = (BigInt(high) << 32n) | BigInt(low);
  // We probably should provide a similar API that returns BigInt values.
  if (big > MAX_SAFE_INTEGER) {
    throw new RangeError(
      "Long value too big to be represented as a JavaScript number.",
    );
  }
  return Number(big);
}
