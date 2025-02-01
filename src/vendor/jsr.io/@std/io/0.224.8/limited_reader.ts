// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Reader } from "./types.ts";

/**
 * Reads from `reader` but limits the amount of data returned to just `limit` bytes.
 * Each call to `read` updates `limit` to reflect the new amount remaining.
 * `read` returns `null` when `limit` <= `0` or
 * when the underlying `reader` returns `null`.
 *
 * @example Usage
 * ```ts
 * import { StringReader } from "@std/io/string-reader";
 * import { LimitedReader } from "@std/io/limited-reader";
 * import { readAll } from "@std/io/read-all";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const r = new StringReader("hello world");
 * const lr = new LimitedReader(r, 5);
 * const res = await readAll(lr);
 *
 * assertEquals(new TextDecoder().decode(res), "hello");
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class LimitedReader implements Reader {
  /**
   * The reader to read from
   *
   * @example Usage
   * ```ts
   * import { StringReader } from "@std/io/string-reader";
   * import { LimitedReader } from "@std/io/limited-reader";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const r = new StringReader("hello world");
   * const lr = new LimitedReader(r, 5);
   *
   * assertEquals(lr.reader, r);
   * ```
   */
  reader: Reader;
  /**
   * The number of bytes to limit the reader to
   *
   * @example Usage
   * ```ts
   * import { StringReader } from "@std/io/string-reader";
   * import { LimitedReader } from "@std/io/limited-reader";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const r = new StringReader("hello world");
   * const lr = new LimitedReader(r, 5);
   *
   * assertEquals(lr.limit, 5);
   * ```
   */
  limit: number;

  /**
   * Construct a new instance.
   *
   * @param reader The reader to read from.
   * @param limit The number of bytes to limit the reader to.
   */
  constructor(reader: Reader, limit: number) {
    this.reader = reader;
    this.limit = limit;
  }

  /**
   * Reads data from the reader.
   *
   * @example Usage
   * ```ts
   * import { StringReader } from "@std/io/string-reader";
   * import { LimitedReader } from "@std/io/limited-reader";
   * import { assertEquals } from "@std/assert/equals";
   *
   * const r = new StringReader("hello world");
   * const lr = new LimitedReader(r, 5);
   *
   * const data = new Uint8Array(5);
   * const res = await lr.read(data);
   *
   * assertEquals(res, 5);
   * assertEquals(new TextDecoder().decode(data), "hello");
   * ```
   *
   * @param p The buffer to read data into.
   * @returns The number of bytes read.
   */
  async read(p: Uint8Array): Promise<number | null> {
    if (this.limit <= 0) {
      return null;
    }

    if (p.length > this.limit) {
      p = p.subarray(0, this.limit);
    }
    const n = await this.reader.read(p);
    if (n === null) {
      return null;
    }

    this.limit -= n;
    return n;
  }
}
