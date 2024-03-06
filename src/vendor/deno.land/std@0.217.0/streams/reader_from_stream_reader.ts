// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { readerFromStreamReader as _readerFromStreamReader } from "../io/reader_from_stream_reader.ts";
import type { Reader } from "../io/types.ts";

/**
 * Create a {@linkcode Reader} from a {@linkcode ReadableStreamDefaultReader}.
 *
 * @example
 * ```ts
 * import { copy } from "https://deno.land/std@$STD_VERSION/io/copy.ts";
 * import { readerFromStreamReader } from "https://deno.land/std@$STD_VERSION/streams/reader_from_stream_reader.ts";
 *
 * const res = await fetch("https://deno.land");
 * using file = await Deno.open("./deno.land.html", { create: true, write: true });
 *
 * const reader = readerFromStreamReader(res.body!.getReader());
 * await copy(reader, file);
 * ```
 *
 * @deprecated (will be removed in 1.0.0) Import from {@link https://deno.land/std/io/reader_from_stream_reader.ts} instead.
 */
export function readerFromStreamReader(
  streamReader: ReadableStreamDefaultReader<Uint8Array>,
): Reader {
  return _readerFromStreamReader(streamReader);
}
