// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

interface TaggedYieldedValue<T> {
  iterator: AsyncIterator<T>;
  value: T;
}

/**
 * Multiplexes multiple async iterators into a single stream. It currently
 * makes an assumption that the final result (the value returned and not
 * yielded from the iterator) does not matter; if there is any result, it is
 * discarded.
 *
 * @example Usage
 * ```ts
 * import { MuxAsyncIterator } from "@std/async/mux-async-iterator";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * async function* gen123(): AsyncIterableIterator<number> {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * }
 *
 * async function* gen456(): AsyncIterableIterator<number> {
 *   yield 4;
 *   yield 5;
 *   yield 6;
 * }
 *
 * const mux = new MuxAsyncIterator<number>();
 * mux.add(gen123());
 * mux.add(gen456());
 *
 * const result = await Array.fromAsync(mux);
 *
 * assertEquals(result, [1, 4, 2, 5, 3, 6]);
 * ```
 *
 * @typeParam T The type of the provided async iterables and generated async iterable.
 */
export class MuxAsyncIterator<T> implements AsyncIterable<T> {
  #iteratorCount = 0;
  #yields: Array<TaggedYieldedValue<T>> = [];
  // deno-lint-ignore no-explicit-any
  #throws: any[] = [];
  #signal = Promise.withResolvers<void>();

  /**
   * Add an async iterable to the stream.
   *
   * @param iterable The async iterable to add.
   *
   * @example Usage
   * ```ts
   * import { MuxAsyncIterator } from "@std/async/mux-async-iterator";
   * import { assertEquals } from "@std/assert/assert-equals";
   *
   * async function* gen123(): AsyncIterableIterator<number> {
   *   yield 1;
   *   yield 2;
   *   yield 3;
   * }
   *
   * const mux = new MuxAsyncIterator<number>();
   * mux.add(gen123());
   *
   * const result = await Array.fromAsync(mux.iterate());
   *
   * assertEquals(result, [1, 2, 3]);
   * ```
   */
  add(iterable: AsyncIterable<T>) {
    ++this.#iteratorCount;
    this.#callIteratorNext(iterable[Symbol.asyncIterator]());
  }

  async #callIteratorNext(
    iterator: AsyncIterator<T>,
  ) {
    try {
      const { value, done } = await iterator.next();
      if (done) {
        --this.#iteratorCount;
      } else {
        this.#yields.push({ iterator, value });
      }
    } catch (e) {
      this.#throws.push(e);
    }
    this.#signal.resolve();
  }

  /**
   * Returns an async iterator of the stream.
   * @returns the async iterator for all the added async iterables.
   *
   * @example Usage
   * ```ts
   * import { MuxAsyncIterator } from "@std/async/mux-async-iterator";
   * import { assertEquals } from "@std/assert/assert-equals";
   *
   * async function* gen123(): AsyncIterableIterator<number> {
   *   yield 1;
   *   yield 2;
   *   yield 3;
   * }
   *
   * const mux = new MuxAsyncIterator<number>();
   * mux.add(gen123());
   *
   * const result = await Array.fromAsync(mux.iterate());
   *
   * assertEquals(result, [1, 2, 3]);
   * ```
   */
  async *iterate(): AsyncIterableIterator<T> {
    while (this.#iteratorCount > 0) {
      // Sleep until any of the wrapped iterators yields.
      await this.#signal.promise;

      // Note that while we're looping over `yields`, new items may be added.
      for (const { iterator, value } of this.#yields) {
        yield value;
        this.#callIteratorNext(iterator);
      }

      if (this.#throws.length) {
        for (const e of this.#throws) {
          throw e;
        }
      }
      // Clear the `yields` list and reset the `signal` promise.
      this.#yields.length = 0;
      this.#signal = Promise.withResolvers<void>();
    }
  }

  /**
   * Implements an async iterator for the stream.
   * @returns the async iterator for all the added async iterables.
   *
   * @example Usage
   * ```ts
   * import { MuxAsyncIterator } from "@std/async/mux-async-iterator";
   * import { assertEquals } from "@std/assert/assert-equals";
   *
   * async function* gen123(): AsyncIterableIterator<number> {
   *   yield 1;
   *   yield 2;
   *   yield 3;
   * }
   *
   * const mux = new MuxAsyncIterator<number>();
   * mux.add(gen123());
   *
   * const result = await Array.fromAsync(mux);
   *
   * assertEquals(result, [1, 2, 3]);
   * ```
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.iterate();
  }
}
