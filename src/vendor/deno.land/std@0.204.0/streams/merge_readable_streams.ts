// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

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
      let mustClose = false;
      Promise.all(resolvePromises)
        .then(() => {
          controller.close();
        })
        .catch((error) => {
          mustClose = true;
          controller.error(error);
        });
      for (const [index, stream] of streams.entries()) {
        (async () => {
          try {
            for await (const data of stream) {
              if (mustClose) {
                break;
              }
              controller.enqueue(data);
            }
            resolvePromises[index].resolve();
          } catch (error) {
            resolvePromises[index].reject(error);
          }
        })();
      }
    },
  });
}
