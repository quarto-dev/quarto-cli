// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// Ported from unicode_width rust crate, Copyright (c) 2015 The Rust Project Developers. MIT license.

import data from "./_data.json" with { type: "json" };
import { runLengthDecode } from "./_run_length.ts";

let tables: Uint8Array[] | null = null;
function lookupWidth(cp: number) {
  if (!tables) tables = data.tables.map(runLengthDecode);

  const t1Offset = (tables[0] as Uint8Array)[(cp >> 13) & 0xff] as number;
  const t2Offset =
    (tables[1] as Uint8Array)[128 * t1Offset + ((cp >> 6) & 0x7f)] as number;
  const packedWidths =
    (tables[2] as Uint8Array)[16 * t2Offset + ((cp >> 2) & 0xf)] as number;

  const width = (packedWidths >> (2 * (cp & 0b11))) & 0b11;

  return width === 3 ? 1 : width;
}

const cache = new Map<string, number | null>();
function charWidth(ch: string) {
  if (cache.has(ch)) return cache.get(ch)!;

  const cp = ch.codePointAt(0)!;
  let v: number | null = null;

  if (cp < 0x7f) {
    v = cp >= 0x20 ? 1 : cp === 0 ? 0 : null;
  } else if (cp >= 0xa0) {
    v = lookupWidth(cp);
  } else {
    v = null;
  }

  cache.set(ch, v);
  return v;
}

/**
 * Calculate the physical width of a string in a TTY-like environment. This is
 * useful for cases such as calculating where a line-wrap will occur and
 * underlining strings.
 *
 * The physical width is given by the number of columns required to display
 * the string. The number of columns a given unicode character occupies can
 * vary depending on the character itself.
 *
 * @param str The string to measure.
 * @returns The unicode width of the string.
 *
 * @example Calculating the unicode width of a string
 * ```ts
 * import { unicodeWidth } from "https://deno.land/std@$STD_VERSION/cli/unicode_width.ts";
 *
 * unicodeWidth("hello world"); // 11
 * unicodeWidth("天地玄黃宇宙洪荒"); // 16
 * unicodeWidth("ｆｕｌｌｗｉｄｔｈ"); // 18
 * ```
 *
 * @example Calculating the unicode width of a color-encoded string
 * ```ts
 * import { unicodeWidth } from "https://deno.land/std@$STD_VERSION/cli/unicode_width.ts";
 * import { stripAnsiCode } from "https://deno.land/std@$STD_VERSION/fmt/colors.ts";
 *
 * unicodeWidth(stripAnsiCode("\x1b[36mголубой\x1b[39m")); // 7
 * unicodeWidth(stripAnsiCode("\x1b[31m紅色\x1b[39m")); // 4
 * unicodeWidth(stripAnsiCode("\x1B]8;;https://deno.land\x07🦕\x1B]8;;\x07")); // 2
 * ```
 *
 * Use
 * {@linkcode https://jsr.io/@std/fmt/doc/colors/~/stripAnsiCode | stripAnsiCode}
 * to remove ANSI escape codes from a string before passing it to
 * {@linkcode unicodeWidth}.
 */
export function unicodeWidth(str: string): number {
  return [...str].map((ch) => charWidth(ch) ?? 0).reduce((a, b) => a + b, 0);
}
