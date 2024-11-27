// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Reader } from "./types.ts";

/**
 * Reader utility for combining multiple readers.
 *
 * @example Usage
 * ```ts
 * import { MultiReader } from "@std/io/multi-reader";
 * import { StringReader } from "@std/io/string-reader";
 * import { readAll } from "@std/io/read-all";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const r1 = new StringReader("hello");
 * const r2 = new StringReader("world");
 * const mr = new MultiReader([r1, r2]);
 *
 * const res = await readAll(mr);
 *
 * assertEquals(new TextDecoder().decode(res), "helloworld");
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class MultiReader implements Reader {
  readonly #readers: Reader[];
  #currentIndex = 0;

  /**
   * Construct a new instance.
   *
   * @param readers The readers to combine.
   */
  constructor(readers: Reader[]) {
    this.#readers = [...readers];
  }

  /**
   * Reads data from the readers.
   *
   * @example Usage
   * ```ts
   * import { MultiReader } from "@std/io/multi-reader";
   * import { StringReader } from "@std/io/string-reader";
   * import { readAll } from "@std/io/read-all";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const r1 = new StringReader("hello");
   * const r2 = new StringReader("world");
   * const mr = new MultiReader([r1, r2]);
   *
   * const data = new Uint8Array(5);
   * const res = await mr.read(data);
   *
   * assertEquals(res, 5);
   * assertEquals(new TextDecoder().decode(data), "hello");
   *
   * const res2 = await mr.read(data);
   * assertEquals(res2, 0);
   *
   * const res3 = await mr.read(data);
   * assertEquals(res3, 5);
   * assertEquals(new TextDecoder().decode(data), "world");
   * ```
   *
   * @param p The buffer to read data into.
   * @returns The number of bytes read.
   */
  async read(p: Uint8Array): Promise<number | null> {
    const r = this.#readers[this.#currentIndex];
    if (!r) return null;
    const result = await r.read(p);
    if (result === null) {
      this.#currentIndex++;
      return 0;
    }
    return result;
  }
}
