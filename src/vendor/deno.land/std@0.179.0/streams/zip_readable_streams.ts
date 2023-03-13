// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

/**
 * Merge multiple streams into a single one, taking order into account, and each stream
 * will wait for a chunk to enqueue before the next stream can append another chunk.
 * If a stream ends before other ones, the others will continue adding data in order,
 * and the finished one will not add any more data.
 */
export function zipReadableStreams<T>(
  ...streams: ReadableStream<T>[]
): ReadableStream<T> {
  const readers = streams.map((s) => s.getReader());
  return new ReadableStream<T>({
    async start(controller) {
      try {
        let resolved = 0;
        while (resolved != streams.length) {
          for (const [key, reader] of Object.entries(readers)) {
            const { value, done } = await reader.read();
            if (!done) {
              controller.enqueue(value!);
            } else {
              resolved++;
              readers.splice(+key, 1);
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
