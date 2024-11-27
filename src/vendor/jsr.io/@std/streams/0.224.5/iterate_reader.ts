// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  iterateReader as _iterateReader,
  iterateReaderSync as _iterateReaderSync,
} from "jsr:/@std/io@^0.224.1/iterate-reader";
import type { Reader, ReaderSync } from "jsr:/@std/io@^0.224.1/types";

export type { Reader, ReaderSync };

/**
 * Turns a {@linkcode https://jsr.io/@std/io/doc/types/~/Reader | Reader}, `r`, into an async iterator.
 *
 * @param r A reader to turn into an async iterator.
 * @param options Options for the iterateReader function.
 * @returns An async iterator that yields Uint8Array.
 *
 * @example Convert a `Deno.FsFile` into an async iterator and iterate over it
 * ```ts no-assert no-eval
 * import { iterateReader } from "@std/streams/iterate-reader";
 *
 * using f = await Deno.open("./README.md");
 * for await (const chunk of iterateReader(f)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * @example Specify a buffer size of 1MiB
 * ```ts no-assert no-eval
 * import { iterateReader } from "@std/streams/iterate-reader";
 *
 * using f = await Deno.open("./README.md");
 * const it = iterateReader(f, {
 *   bufSize: 1024 * 1024
 * });
 * for await (const chunk of it) {
 *   console.log(chunk);
 * }
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Import from
 * {@link https://jsr.io/@std/io | @std/io} instead.
 */
export function iterateReader(
  r: Reader,
  options?: {
    bufSize?: number;
  },
): AsyncIterableIterator<Uint8Array> {
  return _iterateReader(r, options);
}

/**
 * Turns a {@linkcode https://jsr.io/@std/io/doc/types/~/ReaderSync | ReaderSync}, `r`, into an iterator.
 *
 * @param r A reader to turn into an iterator.
 * @param options Options for the iterateReaderSync function.
 * @returns An iterator that yields Uint8Array.
 *
 * @example Convert a `Deno.FsFile` into an iterator and iterate over it
 * ```ts no-eval no-assert
 * import { iterateReaderSync } from "@std/streams/iterate-reader";
 *
 * using f = Deno.openSync("./README.md");
 * for (const chunk of iterateReaderSync(f)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * @example Specify a buffer size of 1MiB
 * ```ts no-eval no-assert
 * import { iterateReaderSync } from "@std/streams/iterate-reader";
 *
 * using f = await Deno.open("./README.md");
 * const iter = iterateReaderSync(f, {
 *   bufSize: 1024 * 1024
 * });
 * for (const chunk of iter) {
 *   console.log(chunk);
 * }
 * ```
 *
 * Iterator uses an internal buffer of fixed size for efficiency; it returns
 * a view on that buffer on each iteration. It is therefore caller's
 * responsibility to copy contents of the buffer if needed; otherwise the
 * next iteration will overwrite contents of previously returned chunk.
 *
 * @deprecated This will be removed in 1.0.0. Import from
 * {@link https://jsr.io/@std/io | @std/io} instead.
 */
export function iterateReaderSync(
  r: ReaderSync,
  options?: {
    bufSize?: number;
  },
): IterableIterator<Uint8Array> {
  return _iterateReaderSync(r, options);
}
