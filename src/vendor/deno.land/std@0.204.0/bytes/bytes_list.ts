// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * An abstraction of multiple Uint8Arrays
 *
 * @deprecated (will be removed in 0.205.0) Use a plain array of Uint8Arrays instead.
 */
export class BytesList {
  #len = 0;
  #chunks: {
    value: Uint8Array;
    start: number; // start offset from head of chunk
    end: number; // end offset from head of chunk
    offset: number; // offset of head in all bytes
  }[] = [];
  constructor() {}

  /**
   * Total size of bytes
   *
   * @deprecated
   */
  size() {
    return this.#len;
  }
  /**
   * Push bytes with given offset infos
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   * Adding into the array can be done with {@linkcode Array#push}.
   * If {@linkcode start} or {@linkcode end} parameters are
   * used then use {@linkcode Uint8Array#subarray}
   * to slice the needed part without copying.
   */
  add(value: Uint8Array, start = 0, end = value.byteLength) {
    if (value.byteLength === 0 || end - start === 0) {
      return;
    }
    checkRange(start, end, value.byteLength);
    this.#chunks.push({
      value,
      end,
      start,
      offset: this.#len,
    });
    this.#len += end - start;
  }

  /**
   * Drop head `n` bytes.
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   * Shifting from the array can be done using conditional
   * {@linkcode Array#shift}s against the number of bytes left
   * to be dropped.
   *
   * If the next item in the array is longer than the number
   * of bytes left to be dropped, then instead of shifting it out
   * it should be replaced in-place with a subarray of itself that
   * drops the remaining bytes from the front.
   */
  shift(n: number) {
    if (n === 0) {
      return;
    }
    if (this.#len <= n) {
      this.#chunks = [];
      this.#len = 0;
      return;
    }
    const idx = this.getChunkIndex(n);
    this.#chunks.splice(0, idx);
    const [chunk] = this.#chunks;
    if (chunk) {
      const diff = n - chunk.offset;
      chunk.start += diff;
    }
    let offset = 0;
    for (const chunk of this.#chunks) {
      chunk.offset = offset;
      offset += chunk.end - chunk.start;
    }
    this.#len = offset;
  }

  /**
   * Find chunk index in which `pos` locates by binary-search
   * returns -1 if out of range
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   * Finding the index of a chunk in the array can be
   * done using {@linkcode Array#findIndex} with a counter
   * for the number of bytes already encountered from past
   * chunks' {@linkcode Uint8Array#byteLength}.
   */
  getChunkIndex(pos: number): number {
    let max = this.#chunks.length;
    let min = 0;
    while (true) {
      const i = min + Math.floor((max - min) / 2);
      if (i < 0 || this.#chunks.length <= i) {
        return -1;
      }
      const { offset, start, end } = this.#chunks[i];
      const len = end - start;
      if (offset <= pos && pos < offset + len) {
        return i;
      } else if (offset + len <= pos) {
        min = i + 1;
      } else {
        max = i - 1;
      }
    }
  }

  /**
   * Get indexed byte from chunks
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   * See {@linkcode getChunkIndex} for finding a chunk
   * by number of bytes.
   */
  get(i: number): number {
    if (i < 0 || this.#len <= i) {
      throw new Error("out of range");
    }
    const idx = this.getChunkIndex(i);
    const { value, offset, start } = this.#chunks[idx];
    return value[start + i - offset];
  }

  /**
   * Iterator of bytes from given position
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   */
  *iterator(start = 0): IterableIterator<number> {
    const startIdx = this.getChunkIndex(start);
    if (startIdx < 0) return;
    const first = this.#chunks[startIdx];
    let firstOffset = start - first.offset;
    for (let i = startIdx; i < this.#chunks.length; i++) {
      const chunk = this.#chunks[i];
      for (let j = chunk.start + firstOffset; j < chunk.end; j++) {
        yield chunk.value[j];
      }
      firstOffset = 0;
    }
  }

  /**
   * Returns subset of bytes copied
   *
   * @deprecated Use a plain array of Uint8Arrays instead.
   * For copying the whole list see {@linkcode concat}.
   * For copying subarrays find the start and end chunk indexes
   * and the internal indexes within those Uint8Arrays, prepare
   * a Uint8Array of size `end - start` and set the chunks (or
   * chunk subarrays) into that at proper offsets.
   */
  slice(start: number, end: number = this.#len): Uint8Array {
    if (end === start) {
      return new Uint8Array();
    }
    checkRange(start, end, this.#len);
    const result = new Uint8Array(end - start);
    const startIdx = this.getChunkIndex(start);
    const endIdx = this.getChunkIndex(end - 1);
    let written = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      const {
        value: chunkValue,
        start: chunkStart,
        end: chunkEnd,
        offset: chunkOffset,
      } = this.#chunks[i];
      const readStart = chunkStart + (i === startIdx ? start - chunkOffset : 0);
      const readEnd = i === endIdx ? end - chunkOffset + chunkStart : chunkEnd;
      const len = readEnd - readStart;
      result.set(chunkValue.subarray(readStart, readEnd), written);
      written += len;
    }
    return result;
  }
  /**
   * Concatenate chunks into single Uint8Array copied.
   *
   * @deprecated Use a plain array of Uint8Arrays and the `concat.ts` module  instead.
   */
  concat(): Uint8Array {
    const result = new Uint8Array(this.#len);
    let sum = 0;
    for (const { value, start, end } of this.#chunks) {
      result.set(value.subarray(start, end), sum);
      sum += end - start;
    }
    return result;
  }
}

function checkRange(start: number, end: number, len: number) {
  if (start < 0 || len < start || end < 0 || len < end || end < start) {
    throw new Error("invalid range");
  }
}
