// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DEFAULT_CHUNK_SIZE } from "./_constants.ts";
import { isCloser } from "./_common.ts";
import type { Closer, Reader } from "./types.ts";

/** Options for {@linkcode toReadableStream}. */
export interface ToReadableStreamOptions {
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
  strategy?: QueuingStrategy<Uint8Array>;
}

/**
 * Create a {@linkcode ReadableStream} of {@linkcode Uint8Array}s from a
 * {@linkcode Reader}.
 *
 * When the pull algorithm is called on the stream, a chunk from the reader
 * will be read.  When `null` is returned from the reader, the stream will be
 * closed along with the reader (if it is also a `Closer`).
 *
 * @example
 * ```ts
 * import { toReadableStream } from "https://deno.land/std@$STD_VERSION/io/to_readable_stream.ts";
 *
 * const file = await Deno.open("./file.txt", { read: true });
 * const fileStream = toReadableStream(file);
 * ```
 */
export function toReadableStream(
  reader: Reader | (Reader & Closer),
  {
    autoClose = true,
    chunkSize = DEFAULT_CHUNK_SIZE,
    strategy,
  }: ToReadableStreamOptions = {},
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async pull(controller) {
      const chunk = new Uint8Array(chunkSize);
      try {
        const read = await reader.read(chunk);
        if (read === null) {
          if (isCloser(reader) && autoClose) {
            reader.close();
          }
          controller.close();
          return;
        }
        controller.enqueue(chunk.subarray(0, read));
      } catch (e) {
        controller.error(e);
        if (isCloser(reader)) {
          reader.close();
        }
      }
    },
    cancel() {
      if (isCloser(reader) && autoClose) {
        reader.close();
      }
    },
  }, strategy);
}
