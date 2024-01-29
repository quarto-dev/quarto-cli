// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { copy as _copy } from "../io/copy.ts";
import type { Reader, Writer } from "../io/types.ts";

/**
 * Copies from `src` to `dst` until either EOF (`null`) is read from `src` or
 * an error occurs. It resolves to the number of bytes copied or rejects with
 * the first error encountered while copying.
 *
 * ```ts
 * import { copy } from "https://deno.land/std@$STD_VERSION/streams/copy.ts";
 *
 * const source = await Deno.open("my_file.txt");
 * const bytesCopied1 = await copy(source, Deno.stdout);
 * const destination = await Deno.create("my_file_2.txt");
 * const bytesCopied2 = await copy(source, destination);
 * ```
 *
 * @param src The source to copy from
 * @param dst The destination to copy to
 * @param options Can be used to tune size of the buffer. Default size is 32kB
 *
 * @deprecated (will be removed in 0.214.0) Import from {@link https://deno.land/std/io/copy.ts} instead.
 */
export async function copy(
  src: Reader,
  dst: Writer,
  options?: {
    bufSize?: number;
  },
): Promise<number> {
  return await _copy(src, dst, options);
}
