// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// Ported from unicode_width rust crate, Copyright (c) 2015 The Rust Project Developers. MIT license.

import { unicodeWidth as _unicodeWidth } from "../cli/unicode_width.ts";

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
 * import { unicodeWidth } from "https://deno.land/std@$STD_VERSION/console/unicode_width.ts";
 *
 * unicodeWidth("hello world"); // 11
 * unicodeWidth("天地玄黃宇宙洪荒"); // 16
 * unicodeWidth("ｆｕｌｌｗｉｄｔｈ"); // 18
 * ```
 *
 * @example Calculating the unicode width of a color-encoded string
 * ```ts
 * import { unicodeWidth } from "https://deno.land/std@$STD_VERSION/console/unicode_width.ts";
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
 *
 * @deprecated Use {@linkcode unicodeWidth} from `std/cli` instead. This will be
 * removed once the Standard Library migrates to {@link https://jsr.io/ | JSR}.
 */
export function unicodeWidth(str: string): number {
  return _unicodeWidth(str);
}
