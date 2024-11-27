// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Writer } from "jsr:/@std/io@^0.224.1/types";
import { toWritableStream } from "jsr:/@std/io@^0.224.1/to-writable-stream";

/**
 * Options for {@linkcode writableStreamFromWriter}.
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode https://jsr.io/@std/io/doc/~/toWritableStream | toWritableStream} instead.
 */
export interface WritableStreamFromWriterOptions {
  /**
   * If the `writer` is also a `Closer`, automatically close the `writer`
   * when the stream is closed, aborted, or a write error occurs.
   *
   * @default {true}
   */
  autoClose?: boolean;
}

/**
 * Create a {@linkcode WritableStream} from a {@linkcode https://jsr.io/@std/io/doc/types/~/Writer | Writer}.
 *
 * @param writer A `Writer` to convert into a `WritableStream`.
 * @param options Options for the `writableStreamFromWriter` function.
 * @returns A `WritableStream` of `Uint8Array`s.
 *
 * @example Convert `Deno.stdout` into a writable stream
 * ```ts no-eval no-assert
 * // Note that you can directly get the writer from `Deno.stdout` by
 * // `Deno.stdout.writable`. This example is just for demonstration purposes;
 * // definitely not a recommended way.
 *
 * import { writableStreamFromWriter } from "@std/streams/writable-stream-from-writer";
 *
 * const stdoutStream = writableStreamFromWriter(Deno.stdout);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode https://jsr.io/@std/io/doc/~/toWritableStream | toWritableStream} instead.
 */
export function writableStreamFromWriter(
  writer: Writer,
  options: WritableStreamFromWriterOptions = {},
): WritableStream<Uint8Array> {
  return toWritableStream(writer, options);
}
