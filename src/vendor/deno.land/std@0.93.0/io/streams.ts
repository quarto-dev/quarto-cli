// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { Buffer } from "./buffer.ts";
import { writeAll } from "./util.ts";

/** Create a `Deno.Reader` from an iterable of `Uint8Array`s.
 *
 *      // Server-sent events: Send runtime metrics to the client every second.
 *      request.respond({
 *        headers: new Headers({ "Content-Type": "text/event-stream" }),
 *        body: readerFromIterable((async function* () {
 *          while (true) {
 *            await new Promise((r) => setTimeout(r, 1000));
 *            const message = `data: ${JSON.stringify(Deno.metrics())}\n\n`;
 *            yield new TextEncoder().encode(message);
 *          }
 *        })()),
 *      });
 */
export function readerFromIterable(
  iterable: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): Deno.Reader {
  const iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array> =
    (iterable as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]?.() ??
      (iterable as Iterable<Uint8Array>)[Symbol.iterator]?.();
  const buffer = new Buffer();
  return {
    async read(p: Uint8Array): Promise<number | null> {
      if (buffer.length == 0) {
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
        if (n == null) {
          return this.read(p);
        }
        return n;
      }
    },
  };
}

/** Create a `Writer` from a `WritableStreamDefaultReader`. */
export function writerFromStreamWriter(
  streamWriter: WritableStreamDefaultWriter<Uint8Array>,
): Deno.Writer {
  return {
    async write(p: Uint8Array): Promise<number> {
      await streamWriter.ready;
      await streamWriter.write(p);
      return p.length;
    },
  };
}

/** Create a `Reader` from a `ReadableStreamDefaultReader`. */
export function readerFromStreamReader(
  streamReader: ReadableStreamDefaultReader<Uint8Array>,
): Deno.Reader {
  const buffer = new Buffer();

  return {
    async read(p: Uint8Array): Promise<number | null> {
      if (buffer.empty()) {
        const res = await streamReader.read();
        if (res.done) {
          return null; // EOF
        }

        await writeAll(buffer, res.value);
      }

      return buffer.read(p);
    },
  };
}

/** Create a `WritableStream` from a `Writer`. */
export function writableStreamFromWriter(
  writer: Deno.Writer,
): WritableStream<Uint8Array> {
  return new WritableStream({
    async write(chunk) {
      await writeAll(writer, chunk);
    },
  });
}

/** Create a `ReadableStream` from any kind of iterable.
 *
 *      const r1 = readableStreamFromIterable(["foo, bar, baz"]);
 *      const r2 = readableStreamFromIterable((async function* () {
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "foo";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "bar";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "baz";
 *      })());
*/
export function readableStreamFromIterable<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
): ReadableStream<T> {
  const iterator: Iterator<T> | AsyncIterator<T> =
    (iterable as AsyncIterable<T>)[Symbol.asyncIterator]?.() ??
      (iterable as Iterable<T>)[Symbol.iterator]?.();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
  });
}
