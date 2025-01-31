// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Concatenates multiple `ReadableStream`s into a single ordered
 * `ReadableStream`.
 *
 * Cancelling the resulting stream will cancel all the input streams.
 *
 * @typeParam T The type of the chunks in the streams.
 * @param streams An iterable of `ReadableStream`s to concat.
 * @returns A `ReadableStream` that will emit the concatenated chunks.
 *
 * @example Usage
 * ```ts
 * import { concatReadableStreams } from "@std/streams/concat-readable-streams";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const stream1 = ReadableStream.from([1, 2, 3]);
 * const stream2 = ReadableStream.from([4, 5, 6]);
 * const stream3 = ReadableStream.from([7, 8, 9]);
 *
 * assertEquals(
 *   await Array.fromAsync(concatReadableStreams(stream1, stream2, stream3)),
 *   [1, 2, 3, 4, 5, 6, 7, 8, 9],
 * );
 * ```
 */
export function concatReadableStreams<T>(
  ...streams: ReadableStream<T>[]
): ReadableStream<T> {
  let i = 0;
  return new ReadableStream<T>({
    async pull(controller) {
      const reader = streams[i]!.getReader();
      const { done, value } = await reader.read();
      if (done) {
        if (streams.length === ++i) {
          return controller.close();
        }
        return await this.pull!(controller);
      }
      controller.enqueue(value);
      reader.releaseLock();
    },
    async cancel(reason) {
      const promises = streams.map((stream) => stream.cancel(reason));
      await Promise.allSettled(promises);
    },
  });
}
