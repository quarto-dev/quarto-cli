// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

const textDecoder = new TextDecoder();

/**
 * Converts a {@linkcode ReadableSteam} of strings or {@linkcode Uint8Array}s
 * to a single string. Works the same as {@linkcode Response.text}.
 *
 * @example
 * ```ts
 * import { toText } from "https://deno.land/std@$STD_VERSION/streams/to_text.ts";
 *
 * const stream = ReadableStream.from(["Hello, ", "world!"]);
 * await toText(stream); // "Hello, world!"
 * ```
 */
export async function toText(
  readableStream: ReadableStream,
): Promise<string> {
  const reader = readableStream.getReader();
  let result = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    result += typeof value === "string" ? value : textDecoder.decode(value);
  }

  return result;
}
