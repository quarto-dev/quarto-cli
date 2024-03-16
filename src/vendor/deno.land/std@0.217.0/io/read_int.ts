// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { type BufReader } from "./buf_reader.ts";
import { readShort } from "./read_short.ts";

/**
 * Read big endian 32bit integer from BufReader
 * @param buf
 *
 * @deprecated (will be removed after 1.0.0) Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function readInt(buf: BufReader): Promise<number | null> {
  const high = await readShort(buf);
  if (high === null) return null;
  const low = await readShort(buf);
  if (low === null) throw new Deno.errors.UnexpectedEof();
  return (high << 16) | low;
}
