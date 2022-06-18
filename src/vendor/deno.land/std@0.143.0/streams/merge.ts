// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { deferred } from "../async/deferred.ts";

/**
 * Merge multiple streams into a single one, not taking order into account.
 * If a stream ends before other ones, the other will continue adding data,
 * and the finished one will not add any more data.
 */
export function mergeReadableStreams<T>(
  ...streams: ReadableStream<T>[]
): ReadableStream<T> {
  const resolvePromises = streams.map(() => deferred<void>());
  return new ReadableStream<T>({
    start(controller) {
      Promise.all(resolvePromises).then(() => {
        controller.close();
      });
      try {
        for (const [key, stream] of Object.entries(streams)) {
          (async () => {
            for await (const data of stream) {
              controller.enqueue(data);
            }
            resolvePromises[+key].resolve();
          })();
        }
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

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

/**
 * Merge multiple streams into a single one, taking order into account, and each stream
 * will wait for a chunk to enqueue before the next stream can append another chunk.
 * If a stream ends before other ones, the others will be cancelled.
 */
export function earlyZipReadableStreams<T>(
  ...streams: ReadableStream<T>[]
): ReadableStream<T> {
  const readers = streams.map((s) => s.getReader());
  return new ReadableStream<T>({
    async start(controller) {
      try {
        loop:
        while (true) {
          for (const reader of readers) {
            const { value, done } = await reader.read();
            if (!done) {
              controller.enqueue(value!);
            } else {
              await Promise.all(readers.map((reader) => reader.cancel()));
              break loop;
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
