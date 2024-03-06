// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  iterateReader as _iterateReader,
  iterateReaderSync as _iterateReaderSync,
} from "../io/iterate_reader.ts";
import type { Reader, ReaderSync } from "../io/types.ts";

export type { Reader, ReaderSync };

/**
 * Turns a {@linkcode Reader}, `r`, into an async iterator.
 *
 * @example
 * ```ts
 * import { iterateReader } from "https://deno.land/std@$STD_VERSION/streams/iterate_reader.ts";
 *
 * using f = await Deno.open("/etc/passwd");
 * for await (const chunk of iterateReader(f)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * Second argument can be used to tune size of a buffer.
 * Default size of the buffer is 32kB.
 *
 * @example
 * ```ts
 * import { iterateReader } from "https://deno.land/std@$STD_VERSION/streams/iterate_reader.ts";
 *
 * using f = await Deno.open("/etc/passwd");
 * const it = iterateReader(f, {
 *   bufSize: 1024 * 1024
 * });
 * for await (const chunk of it) {
 *   console.log(chunk);
 * }
 * ```
 *
 * @deprecated (will be removed in 1.0.0) Import from {@link https://deno.land/std/io/iterate_reader.ts} instead.
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
 * Turns a {@linkcode ReaderSync}, `r`, into an iterator.
 *
 * ```ts
 * import { iterateReaderSync } from "https://deno.land/std@$STD_VERSION/streams/iterate_reader.ts";
 *
 * using f = Deno.openSync("/etc/passwd");
 * for (const chunk of iterateReaderSync(f)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * Second argument can be used to tune size of a buffer.
 * Default size of the buffer is 32kB.
 *
 * ```ts
 * import { iterateReaderSync } from "https://deno.land/std@$STD_VERSION/streams/iterate_reader.ts";

 * using f = await Deno.open("/etc/passwd");
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
 * @deprecated (will be removed in 1.0.0) Import from {@link https://deno.land/std/io/iterate_reader.ts} instead.
 */
export function iterateReaderSync(
  r: ReaderSync,
  options?: {
    bufSize?: number;
  },
): IterableIterator<Uint8Array> {
  return _iterateReaderSync(r, options);
}
