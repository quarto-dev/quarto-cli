// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Buffer } from "jsr:/@std/io@^0.224.1/buffer";
import { writeAll } from "jsr:/@std/io@^0.224.1/write-all";
import type { Reader } from "jsr:/@std/io@^0.224.1/types";

/**
 * Create a {@linkcode https://jsr.io/@std/io/doc/types/~/Reader | Reader} from an iterable of {@linkcode Uint8Array}s.
 *
 * @param iterable An iterable or async iterable of `Uint8Array`s to convert into a `Reader`.
 * @returns A `Reader` that reads from the iterable.
 *
 * @example Write `Deno.build` information to the blackhole 3 times every second
 * ```ts no-eval no-assert
 * import { readerFromIterable } from "@std/streams/reader-from-iterable";
 * import { copy } from "@std/io/copy";
 * import { delay } from "@std/async/delay";
 * import { devNull } from "node:os";
 *
 * const reader = readerFromIterable((async function* () {
 *   for (let i = 0; i < 3; i++) {
 *     await delay(1000);
 *     const message = `data: ${JSON.stringify(Deno.build)}\n\n`;
 *     yield new TextEncoder().encode(message);
 *   }
 * })());
 *
 * using blackhole = await Deno.open(devNull, { write: true });
 * await copy(reader, blackhole);
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode ReadableStream.from} instead.
 */
export function readerFromIterable(
  iterable: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): Reader {
  const iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array> =
    (iterable as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]?.() ??
      (iterable as Iterable<Uint8Array>)[Symbol.iterator]?.();
  const buffer = new Buffer();
  return {
    async read(p: Uint8Array): Promise<number | null> {
      if (buffer.length === 0) {
        const result = await iterator.next();
        if (result.done) {
          return null;
        } else {
          if (result.value.byteLength <= p.byteLength) {
            p.set(result.value);
            return result.value.byteLength;
          }
          p.set(result.value.subarray(0, p.byteLength));
          await writeAll(buffer, result.value.subarray(p.byteLength));
          return p.byteLength;
        }
      } else {
        const n = await buffer.read(p);
        if (n === null) {
          return this.read(p);
        }
        return n;
      }
    },
  };
}
