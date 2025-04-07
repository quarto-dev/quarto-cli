// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { BufReader } from "./buf_reader.ts";

/**
 * Read big endian 16bit short from a {@linkcode BufReader}.
 *
 * @example Usage
 * ```ts
 * import { Buffer } from "@std/io/buffer"
 * import { BufReader } from "@std/io/buf-reader";
 * import { readShort } from "@std/io/read-short";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const buf = new BufReader(new Buffer(new Uint8Array([0x12, 0x34])));
 * const short = await readShort(buf);
 * assertEquals(short, 0x1234);
 * ```
 *
 * @param buf The reader to read from
 * @returns The 16bit short
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function readShort(buf: BufReader): Promise<number | null> {
  const high = await buf.readByte();
  if (high === null) return null;
  const low = await buf.readByte();
  if (low === null) throw new Deno.errors.UnexpectedEof();
  return (high << 8) | low;
}
