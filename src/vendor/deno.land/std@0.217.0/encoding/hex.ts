// Copyright 2009 The Go Authors. All rights reserved.
// https://github.com/golang/go/blob/master/LICENSE
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Port of the Go
 * {@link https://github.com/golang/go/blob/go1.12.5/src/encoding/hex/hex.go | encoding/hex}
 * library.
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import {
 *   decodeHex,
 *   encodeHex,
 * } from "https://deno.land/std@$STD_VERSION/encoding/hex.ts";
 *
 * const binary = new TextEncoder().encode("abc");
 * const encoded = encodeHex(binary);
 * console.log(encoded);
 * // => "616263"
 *
 * console.log(decodeHex(encoded));
 * // => Uint8Array(3) [ 97, 98, 99 ]
 * ```
 *
 * @module
 */

import { validateBinaryLike } from "./_util.ts";

const hexTable = new TextEncoder().encode("0123456789abcdef");
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function errInvalidByte(byte: number) {
  return new TypeError(`Invalid byte '${String.fromCharCode(byte)}'`);
}

function errLength() {
  return new RangeError("Odd length hex string");
}

/** Converts a hex character into its value. */
function fromHexChar(byte: number): number {
  // '0' <= byte && byte <= '9'
  if (48 <= byte && byte <= 57) return byte - 48;
  // 'a' <= byte && byte <= 'f'
  if (97 <= byte && byte <= 102) return byte - 97 + 10;
  // 'A' <= byte && byte <= 'F'
  if (65 <= byte && byte <= 70) return byte - 65 + 10;

  throw errInvalidByte(byte);
}

/**
 * Converts data into a hex-encoded string.
 *
 * @example
 * ```ts
 * import { encodeHex } from "https://deno.land/std@$STD_VERSION/encoding/hex.ts";
 *
 * encodeHex("abc"); // "616263"
 * ```
 */
export function encodeHex(src: string | Uint8Array | ArrayBuffer): string {
  const u8 = validateBinaryLike(src);

  const dst = new Uint8Array(u8.length * 2);
  for (let i = 0; i < dst.length; i++) {
    const v = u8[i];
    dst[i * 2] = hexTable[v >> 4];
    dst[i * 2 + 1] = hexTable[v & 0x0f];
  }
  return textDecoder.decode(dst);
}

/**
 * Decodes the given hex-encoded string. If the input is malformed, an error is
 * thrown.
 *
 * @example
 * ```ts
 * import { decodeHex } from "https://deno.land/std@$STD_VERSION/encoding/hex.ts";
 *
 * decodeHex("616263"); // Uint8Array(3) [ 97, 98, 99 ]
 * ```
 */
export function decodeHex(src: string): Uint8Array {
  const u8 = textEncoder.encode(src);
  const dst = new Uint8Array(u8.length / 2);
  for (let i = 0; i < dst.length; i++) {
    const a = fromHexChar(u8[i * 2]);
    const b = fromHexChar(u8[i * 2 + 1]);
    dst[i] = (a << 4) | b;
  }

  if (u8.length % 2 === 1) {
    // Check for invalid char before reporting bad length,
    // since the invalid char (if present) is an earlier problem.
    fromHexChar(u8[dst.length * 2]);
    throw errLength();
  }

  return dst;
}
