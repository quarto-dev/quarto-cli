// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Buffer } from "./buffer.ts";

/**
 * Reader utility for strings.
 *
 * @example Usage
 * ```ts
 * import { StringReader } from "@std/io/string-reader";
 * import { assertEquals } from "@std/assert/equals";
 *
 * const data = new Uint8Array(6);
 * const r = new StringReader("abcdef");
 * const res0 = await r.read(data);
 * const res1 = await r.read(new Uint8Array(6));
 *
 * assertEquals(res0, 6);
 * assertEquals(res1, null);
 * assertEquals(new TextDecoder().decode(data), "abcdef");
 * ```
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export class StringReader extends Buffer {
  /**
   * Construct a new instance.
   *
   * @param s The string to read.
   */
  constructor(s: string) {
    super(new TextEncoder().encode(s).buffer);
  }
}
