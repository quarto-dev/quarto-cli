// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { assert } from "../testing/asserts.ts";

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
    a = new DataView(ArrayBuffer.isView(a) ? a.buffer : a);
  }
  if (!(b instanceof DataView)) {
    b = new DataView(ArrayBuffer.isView(b) ? b.buffer : b);
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
