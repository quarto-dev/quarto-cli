// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * A transform stream that only transforms from the zero-indexed `start` and
 * `end` bytes (both inclusive).
 *
 * @example Basic usage
 * ```ts
 * import { ByteSliceStream } from "@std/streams/byte-slice-stream";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const stream = ReadableStream.from([
 *   new Uint8Array([0, 1]),
 *   new Uint8Array([2, 3, 4]),
 * ]);
 * const slicedStream = stream.pipeThrough(new ByteSliceStream(1, 3));
 *
 * assertEquals(
 *   await Array.fromAsync(slicedStream),
 *  [new Uint8Array([1]), new Uint8Array([2, 3])]
 * );
 * ```
 *
 * @example Get a range of bytes from a fetch response body
 * ```ts
 * import { ByteSliceStream } from "@std/streams/byte-slice-stream";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const response = await fetch("https://example.com");
 * const rangedStream = response.body!
 *   .pipeThrough(new ByteSliceStream(3, 8));
 * const collected = await Array.fromAsync(rangedStream);
 * assertEquals(collected[0]?.length, 6);
 * ```
 */
export class ByteSliceStream extends TransformStream<Uint8Array, Uint8Array> {
  #offsetStart = 0;
  #offsetEnd = 0;

  /**
   * Constructs a new instance.
   *
   * @param start The zero-indexed byte index to start reading from.
   * @param end The zero-indexed byte index to stop reading at. Inclusive.
   *
   * @example No parameters
   * ```ts no-assert
   * import { ByteSliceStream } from "@std/streams/byte-slice-stream";
   *
   * const byteSliceStream = new ByteSliceStream();
   * ```
   *
   * @example start = 4, end = 11
   * ```ts no-assert
   * import { ByteSliceStream } from "@std/streams/byte-slice-stream";
   *
   * const byteSliceStream = new ByteSliceStream(4, 11);
   * ```
   */
  constructor(start = 0, end: number = Infinity) {
    super({
      start: () => {
        if (start < 0) {
          throw new RangeError("`start` must be greater than 0");
        }
        end += 1;
      },
      transform: (chunk, controller) => {
        this.#offsetStart = this.#offsetEnd;
        this.#offsetEnd += chunk.byteLength;
        if (this.#offsetEnd > start) {
          if (this.#offsetStart < start) {
            chunk = chunk.slice(start - this.#offsetStart);
          }
          if (this.#offsetEnd >= end) {
            chunk = chunk.slice(0, chunk.byteLength - this.#offsetEnd + end);
            controller.enqueue(chunk);
            controller.terminate();
          } else {
            controller.enqueue(chunk);
          }
        }
      },
    });
  }
}
