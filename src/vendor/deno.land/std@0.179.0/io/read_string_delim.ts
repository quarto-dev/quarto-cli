// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import { type Reader } from "../types.d.ts";
import { readDelim } from "./read_delim.ts";

/**
 * Read Reader chunk by chunk, splitting based on delimiter.
 *
 * @example
 * ```ts
 * import { readStringDelim } from "https://deno.land/std@$STD_VERSION/io/read_string_delim.ts";
 * import * as path from "https://deno.land/std@$STD_VERSION/path/mod.ts";
 *
 * const filename = path.join(Deno.cwd(), "std/io/README.md");
 * let fileReader = await Deno.open(filename);
 *
 * for await (let line of readStringDelim(fileReader, "\n")) {
 *   console.log(line);
 * }
 * ```
 */
export async function* readStringDelim(
  reader: Reader,
  delim: string,
  decoderOpts?: {
    encoding?: string;
    fatal?: boolean;
    ignoreBOM?: boolean;
  },
): AsyncIterableIterator<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
  for await (const chunk of readDelim(reader, encoder.encode(delim))) {
    yield decoder.decode(chunk);
  }
}
