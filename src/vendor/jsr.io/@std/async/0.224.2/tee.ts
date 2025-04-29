// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Utility for representing n-tuple. Used in {@linkcode tee}. */
export type Tuple<T, N extends number> = N extends N
  ? number extends N ? T[] : TupleOf<T, N, []>
  : never;

/** Utility for representing n-tuple of. Used in {@linkcode Tuple}. */
export type TupleOf<T, N extends number, R extends unknown[]> =
  R["length"] extends N ? R
    : TupleOf<T, N, [T, ...R]>;

interface QueueNode<T> {
  value: T;
  next: QueueNode<T> | undefined;
}

class Queue<T> {
  #source: AsyncIterator<T>;
  #queue: QueueNode<T>;
  head: QueueNode<T>;

  done: boolean;

  constructor(iterable: AsyncIterable<T>) {
    this.#source = iterable[Symbol.asyncIterator]();
    this.#queue = {
      value: undefined!,
      next: undefined,
    };
    this.head = this.#queue;
    this.done = false;
  }

  async next() {
    const result = await this.#source.next();
    if (!result.done) {
      const nextNode: QueueNode<T> = {
        value: result.value,
        next: undefined,
      };
      this.#queue.next = nextNode;
      this.#queue = nextNode;
    } else {
      this.done = true;
    }
  }
}

/**
 * Branches the given async iterable into the `n` branches.
 *
 * @example Usage
 * ```ts
 * import { tee } from "@std/async/tee";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const gen = async function* gen() {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * };
 *
 * const [branch1, branch2] = tee(gen());
 *
 * const result1 = await Array.fromAsync(branch1);
 * assertEquals(result1, [1, 2, 3]);
 *
 * const result2 = await Array.fromAsync(branch2);
 * assertEquals(result2, [1, 2, 3]);
 * ```
 *
 * @typeParam T The type of the provided async iterable and the returned async iterables.
 * @typeParam N The amount of branches to tee into.
 * @param iterable The iterable to tee.
 * @param n The amount of branches to tee into.
 * @returns The tuple where each element is an async iterable.
 */
export function tee<T, N extends number = 2>(
  iterable: AsyncIterable<T>,
  n: N = 2 as N,
): Tuple<AsyncIterable<T>, N> {
  const queue = new Queue<T>(iterable);

  async function* generator(): AsyncGenerator<T> {
    let buffer = queue.head;
    while (true) {
      if (buffer.next) {
        buffer = buffer.next;
        yield buffer.value;
      } else if (queue.done) {
        return;
      } else {
        await queue.next();
      }
    }
  }

  return Array.from({ length: n }).map(
    () => generator(),
  ) as Tuple<
    AsyncIterable<T>,
    N
  >;
}
