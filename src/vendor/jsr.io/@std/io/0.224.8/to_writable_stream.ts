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
 * @example Usage
 * ```ts no-assert
 * import { toWritableStream } from "@std/io/to-writable-stream";
 *
 * await ReadableStream.from(["Hello World"])
 *   .pipeThrough(new TextEncoderStream())
 *   .pipeTo(toWritableStream(Deno.stdout));
 * ```
 *
 * @param writer The writer to write to
 * @param options The options
 * @returns The writable stream
 */
export function toWritableStream(
  writer: Writer,
  options?: toWritableStreamOptions,
): WritableStream<Uint8Array> {
  const { autoClose = true } = options ?? {};

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
