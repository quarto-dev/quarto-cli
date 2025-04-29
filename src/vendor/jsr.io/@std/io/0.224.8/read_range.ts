// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { copy as copyBytes } from "jsr:@std/bytes@^1.0.2/copy";
import type { Reader, ReaderSync, Seeker, SeekerSync } from "./types.ts";

const DEFAULT_BUFFER_SIZE = 32 * 1024;

/**
 * The range of bytes to read from a file or other resource that is readable.
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export interface ByteRange {
  /** The 0 based index of the start byte for a range. */
  start: number;

  /** The 0 based index of the end byte for a range, which is inclusive. */
  end: number;
}

/**
 * Read a range of bytes from a file or other resource that is readable and
 * seekable.  The range start and end are inclusive of the bytes within that
 * range.
 *
 * @example Usage
 * ```ts no-eval
 * import { assertEquals } from "@std/assert";
 * import { readRange } from "@std/io/read-range";
 *
 * // Read the first 10 bytes of a file
 * const file = await Deno.open("example.txt", { read: true });
 * const bytes = await readRange(file, { start: 0, end: 9 });
 * assertEquals(bytes.length, 10);
 * ```
 *
 * @param r The reader to read from
 * @param range The range of bytes to read
 * @returns The bytes read
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function readRange(
  r: Reader & Seeker,
  range: ByteRange,
): Promise<Uint8Array> {
  // byte ranges are inclusive, so we have to add one to the end
  let length = range.end - range.start + 1;
  if (length <= 0) {
    throw new RangeError("Byte range start cannot be larger than end");
  }
  await r.seek(range.start, Deno.SeekMode.Start);
  const result = new Uint8Array(length);
  let off = 0;
  while (length) {
    const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
    const nread = await r.read(p);
    if (nread === null) {
      throw new Error("Unexpected EOF reach while reading a range");
    }
    if (nread === 0) {
      throw new Error("Unexpected read of 0 bytes while reading a range");
    }
    copyBytes(p, result, off);
    off += nread;
    length -= nread;
    if (length < 0) {
      throw new Error("Unexpected length remaining after reading range");
    }
  }
  return result;
}

/**
 * Read a range of bytes synchronously from a file or other resource that is
 * readable and seekable.  The range start and end are inclusive of the bytes
 * within that range.
 *
 * @example Usage
 * ```ts no-eval
 * import { assertEquals } from "@std/assert";
 * import { readRangeSync } from "@std/io/read-range";
 *
 * // Read the first 10 bytes of a file
 * const file = Deno.openSync("example.txt", { read: true });
 * const bytes = readRangeSync(file, { start: 0, end: 9 });
 * assertEquals(bytes.length, 10);
 * ```
 *
 * @param r The reader to read from
 * @param range The range of bytes to read
 * @returns The bytes read
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export function readRangeSync(
  r: ReaderSync & SeekerSync,
  range: ByteRange,
): Uint8Array {
  // byte ranges are inclusive, so we have to add one to the end
  let length = range.end - range.start + 1;
  if (length <= 0) {
    throw new RangeError("Byte range start cannot be larger than end");
  }
  r.seekSync(range.start, Deno.SeekMode.Start);
  const result = new Uint8Array(length);
  let off = 0;
  while (length) {
    const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
    const nread = r.readSync(p);
    if (nread === null) {
      throw new Error("Unexpected EOF reach while reading a range");
    }
    if (nread === 0) {
      throw new Error("Unexpected read of 0 bytes while reading a range");
    }
    copyBytes(p, result, off);
    off += nread;
    length -= nread;
    if (length < 0) {
      throw new Error("Unexpected length remaining after reading range");
    }
  }
  return result;
}
