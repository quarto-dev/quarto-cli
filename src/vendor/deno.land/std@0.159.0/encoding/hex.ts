// Copyright 2009 The Go Authors. All rights reserved.
// https://github.com/golang/go/blob/master/LICENSE
// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** Port of the Go
 * [encoding/hex](https://github.com/golang/go/blob/go1.12.5/src/encoding/hex/hex.go)
 * library.
 *
 * This module is browser compatible.
 *
 * @module
 */

const hexTable = new TextEncoder().encode("0123456789abcdef");

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

/** Encodes `src` into `src.length * 2` bytes. */
export function encode(src: Uint8Array): Uint8Array {
  const dst = new Uint8Array(src.length * 2);
  for (let i = 0; i < dst.length; i++) {
    const v = src[i];
    dst[i * 2] = hexTable[v >> 4];
    dst[i * 2 + 1] = hexTable[v & 0x0f];
  }
  return dst;
}

/**
 * Decodes `src` into `src.length / 2` bytes.
 * If the input is malformed, an error will be thrown.
 */
export function decode(src: Uint8Array): Uint8Array {
  const dst = new Uint8Array(src.length / 2);
  for (let i = 0; i < dst.length; i++) {
    const a = fromHexChar(src[i * 2]);
    const b = fromHexChar(src[i * 2 + 1]);
    dst[i] = (a << 4) | b;
  }

  if (src.length % 2 == 1) {
    // Check for invalid char before reporting bad length,
    // since the invalid char (if present) is an earlier problem.
    fromHexChar(src[dst.length * 2]);
    throw errLength();
  }

  return dst;
}
