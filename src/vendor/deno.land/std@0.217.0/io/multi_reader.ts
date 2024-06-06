// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Reader } from "./types.ts";

/**
 * Reader utility for combining multiple readers
 *
 * @deprecated (will be removed after 1.0.0) Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class MultiReader implements Reader {
  readonly #readers: Reader[];
  #currentIndex = 0;

  constructor(readers: Reader[]) {
    this.#readers = [...readers];
  }

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
