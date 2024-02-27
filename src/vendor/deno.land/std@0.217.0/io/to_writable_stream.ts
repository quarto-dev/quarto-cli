// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { writeAll } from "./write_all.ts";
import type { Writer } from "./types.ts";
import { isCloser } from "./_common.ts";

/** Options for {@linkcode toWritableStream}. */
export interface toWritableStreamOptions {
  /**
   * If the `writer` is also a `Closer`, automatically close the `writer`
   * when the stream is closed, aborted, or a write error occurs.
   *
   * @default {true}
   */
  autoClose?: boolean;
}

/**
 * Create a {@linkcode WritableStream} from a {@linkcode Writer}.
 *
 * @example
 * ```ts
 * import { toWritableStream } from "https://deno.land/std@$STD_VERSION/io/to_writable_stream.ts";
 *
 * const file = await Deno.open("./file.txt", { create: true, write: true });
 * await ReadableStream.from("Hello World")
 *   .pipeThrough(new TextEncoderStream())
 *   .pipeTo(toWritableStream(file));
 * ```
 */
export function toWritableStream(
  writer: Writer,
  { autoClose = true }: toWritableStreamOptions = {},
): WritableStream<Uint8Array> {
  return new WritableStream({
    async write(chunk, controller) {
      try {
        await writeAll(writer, chunk);
      } catch (e) {
        controller.error(e);
        if (isCloser(writer) && autoClose) {
          writer.close();
        }
      }
    },
    close() {
      if (isCloser(writer) && autoClose) {
        writer.close();
      }
    },
    abort() {
      if (isCloser(writer) && autoClose) {
        writer.close();
      }
    },
  });
}
