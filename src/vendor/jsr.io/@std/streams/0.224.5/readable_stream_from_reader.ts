// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { toReadableStream } from "jsr:/@std/io@^0.224.1/to-readable-stream";
import type { Closer, Reader } from "jsr:/@std/io@^0.224.1/types";
export type { Closer };

/**
 * Options for {@linkcode readableStreamFromReader}.
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode https://jsr.io/@std/io/doc/~/toReadableStream | toReadableStream} instead.
 */
export interface ReadableStreamFromReaderOptions {
  /** If the `reader` is also a `Closer`, automatically close the `reader`
   * when `EOF` is encountered, or a read error occurs.
   *
   * @default {true}
   */
  autoClose?: boolean;

  /** The size of chunks to allocate to read, the default is ~16KiB, which is
   * the maximum size that Deno operations can currently support. */
  chunkSize?: number;

  /** The queuing strategy to create the `ReadableStream` with. */
  strategy?: { highWaterMark?: number | undefined; size?: undefined };
}

/**
 * Create a {@linkcode ReadableStream} of {@linkcode Uint8Array}s from a
 * {@linkcode https://jsr.io/@std/io/doc/types/~/Reader | Reader}.
 *
 * When the pull algorithm is called on the stream, a chunk from the reader
 * will be read.  When `null` is returned from the reader, the stream will be
 * closed along with the reader (if it is also a {@linkcode https://jsr.io/@std/io/doc/types/~/Closer | Closer}).
 *
 * @param reader A reader to convert into a `ReadableStream`.
 * @param options Options for the `readableStreamFromReader` function.
 * @returns A `ReadableStream` of `Uint8Array`s.
 *
 * @example Convert a `Deno.FsFile` into a readable stream:
 * ```ts no-eval no-assert
 * import { readableStreamFromReader } from "@std/streams/readable-stream-from-reader";
 *
 * using file = await Deno.open("./README.md", { read: true });
 * const fileStream = readableStreamFromReader(file);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode https://jsr.io/@std/io/doc/~/toReadableStream | toReadableStream} instead.
 */
export function readableStreamFromReader(
  reader: Reader | (Reader & Closer),
  options: ReadableStreamFromReaderOptions = {},
): ReadableStream<Uint8Array> {
  return toReadableStream(reader, options);
}
