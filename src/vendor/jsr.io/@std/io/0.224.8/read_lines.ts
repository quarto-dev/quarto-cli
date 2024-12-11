// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Reader } from "./types.ts";
import { BufReader } from "./buf_reader.ts";
import { concat } from "jsr:@std/bytes@^1.0.2/concat";

/**
 * Read strings line-by-line from a {@linkcode Reader}.
 *
 * @example Usage
 * ```ts
 * import { readLines } from "@std/io/read-lines";
 * import { assert } from "@std/assert/assert"
 *
 * let fileReader = await Deno.open("README.md");
 *
 * for await (let line of readLines(fileReader)) {
 *   assert(typeof line === "string");
 * }
 * ```
 *
 * @param reader The reader to read from
 * @param decoderOpts The options
 * @returns The async iterator of strings
 *
 * @deprecated This will be removed in 1.0.0. Use the {@link https://developer.mozilla.org/en-US/docs/Web/API/Streams_API | Web Streams API} instead.
 */
export async function* readLines(
  reader: Reader,
  decoderOpts?: {
    encoding?: string;
    fatal?: boolean;
    ignoreBOM?: boolean;
  },
): AsyncIterableIterator<string> {
  const bufReader = new BufReader(reader);
  let chunks: Uint8Array[] = [];
  const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
  while (true) {
    const res = await bufReader.readLine();
    if (!res) {
      if (chunks.length > 0) {
        yield decoder.decode(concat(chunks));
      }
      break;
    }
    chunks.push(res.line);
    if (!res.more) {
      yield decoder.decode(concat(chunks));
      chunks = [];
    }
  }
}
