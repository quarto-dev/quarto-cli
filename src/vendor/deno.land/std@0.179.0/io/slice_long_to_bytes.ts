// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

/**
 * Slice number into 64bit big endian byte array
 * @param d The number to be sliced
 * @param dest The sliced array
 */
export function sliceLongToBytes(
  d: number,
  dest = Array.from<number>({ length: 8 }),
): number[] {
  let big = BigInt(d);
  for (let i = 0; i < 8; i++) {
    dest[7 - i] = Number(big & 0xffn);
    big >>= 8n;
  }
  return dest;
}
