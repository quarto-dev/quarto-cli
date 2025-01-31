// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Writer } from "jsr:/@std/io@^0.224.1/types";

export type { Writer };

/**
 * Create a {@linkcode https://jsr.io/@std/io/doc/types/~/Writer | Writer} from a {@linkcode WritableStreamDefaultWriter}.
 *
 * @param streamWriter A `WritableStreamDefaultWriter` to convert into a `Writer`.
 * @returns A `Writer` that writes to the `WritableStreamDefaultWriter`.
 *
 * @example Read from a file and write to stdout using a writable stream
 * ```ts no-eval no-assert
 * import { copy } from "@std/io/copy";
 * import { writerFromStreamWriter } from "@std/streams/writer-from-stream-writer";
 *
 * using file = await Deno.open("./README.md", { read: true });
 *
 * const writableStream = new WritableStream({
 *   write(chunk): void {
 *     console.log(chunk);
 *   },
 * });
 * const writer = writerFromStreamWriter(writableStream.getWriter());
 * await copy(file, writer);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode WritableStreamDefaultWriter} directly.
 */
export function writerFromStreamWriter(
  streamWriter: WritableStreamDefaultWriter<Uint8Array>,
): Writer {
  return {
    async write(p: Uint8Array): Promise<number> {
      await streamWriter.ready;
      await streamWriter.write(p);
      return p.length;
    },
  };
}
