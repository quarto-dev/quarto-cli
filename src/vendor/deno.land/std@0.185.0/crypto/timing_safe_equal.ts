// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { assert } from "../_util/asserts.ts";

/** Compare to array buffers or data views in a way that timing based attacks
 * cannot gain information about the platform. */
export function timingSafeEqual(
  a: ArrayBufferView | ArrayBufferLike | DataView,
  b: ArrayBufferView | ArrayBufferLike | DataView,
): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  if (!(a instanceof DataView)) {
    a = ArrayBuffer.isView(a)
      ? new DataView(a.buffer, a.byteOffset, a.byteLength)
      : new DataView(a);
  }
  if (!(b instanceof DataView)) {
    b = ArrayBuffer.isView(b)
      ? new DataView(b.buffer, b.byteOffset, b.byteLength)
      : new DataView(b);
  }
  assert(a instanceof DataView);
  assert(b instanceof DataView);
  const length = a.byteLength;
  let out = 0;
  let i = -1;
  while (++i < length) {
    out |= a.getUint8(i) ^ b.getUint8(i);
  }
  return out === 0;
}
