// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import type { Reader } from "../types.d.ts";

/** Reader utility for combining multiple readers */
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
