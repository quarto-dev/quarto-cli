// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { bytesToUuid } from "./_common.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the UUID v1.
 *
 * @example
 * ```ts
 * import { validate } from "https://deno.land/std@$STD_VERSION/uuid/v1.ts";
 *
 * validate("ea71fc60-a713-11ee-af61-8349da24f689");  // true
 * validate("fac8c1e0-ad1a-4204-a0d0-8126ae84495d");  // false
 * ```
 *
 * @param id UUID value.
 */
export function validate(id: string): boolean {
  return UUID_RE.test(id);
}

let _nodeId: number[];
let _clockseq: number;

let _lastMSecs = 0;
let _lastNSecs = 0;

/** The options used for generating a v1 UUID in {@linkcode generate}. */
export interface V1Options {
  /**
   * An array of 6 bytes that represents a 48-bit IEEE 802 MAC address.
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc4122#section-4.1.6}
   */
  node?: number[];
  /**
   * A 14-bit value used to avoid duplicates that could arise when the clock is
   * set backwards in time or if the node ID changes (0 - 16383).
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc4122#section-4.1.5}
   */
  clockseq?: number;
  /**
   * The number of milliseconds since the Unix epoch (January 1, 1970).
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc4122#section-4.1.4}
   */
  msecs?: number;
  /**
   * The number of nanoseconds to add to {@linkcode V1Options.msecs}
   * (0 - 10,000).
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc4122#section-4.1.4}
   */
  nsecs?: number;
  /** An array of 16 random bytes (0 - 255). */
  random?: number[];
  /**
   * A function that returns an array of 16 random bytes (0 - 255).
   * Alternative to {@linkcode V1Options.random}.
   */
  rng?: () => number[];
}

/**
 * Generates a RFC4122 v1 UUID (time-based).
 *
 * @example
 * ```ts
 * import { generate } from "https://deno.land/std@$STD_VERSION/uuid/v1.ts";
 *
 * const options = {
 *   node: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
 *   clockseq: 0x1234,
 *   msecs: new Date("2011-11-01").getTime(),
 *   nsecs: 5678,
 * };
 *
 * generate(options); // "710b962e-041c-11e1-9234-0123456789ab"
 * ```
 *
 * @param options Can use RFC time sequence values as overwrites.
 * @param buf Can allow the UUID to be written in byte-form starting at the offset.
 * @param offset Index to start writing on the UUID bytes in buffer.
 */
export function generate(
  options?: V1Options | null,
  buf?: number[],
  offset?: number,
): string | number[] {
  let i = (buf && offset) || 0;
  const b = buf ?? [];

  options ??= {};
  let { node = _nodeId, clockseq = _clockseq } = options;

  if (node === undefined || clockseq === undefined) {
    // deno-lint-ignore no-explicit-any
    const seedBytes: any = options.random ??
      options.rng ??
      crypto.getRandomValues(new Uint8Array(16));

    if (node === undefined) {
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1],
        seedBytes[2],
        seedBytes[3],
        seedBytes[4],
        seedBytes[5],
      ];
    }

    if (clockseq === undefined) {
      clockseq = _clockseq = ((seedBytes[6] << 8) | seedBytes[7]) & 0x3fff;
    }
  }

  let { msecs = new Date().getTime(), nsecs = _lastNSecs + 1 } = options;

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = (clockseq + 1) & 0x3fff;
  }

  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  if (nsecs > 10000) {
    throw new Error("Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // We have to add this value because "msecs" here is the number of
  // milliseconds since January 1, 1970, not since October 15, 1582.
  // This is also the milliseconds from October 15, 1582 to January 1, 1970.
  msecs += 12219292800000;

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = (tl >>> 24) & 0xff;
  b[i++] = (tl >>> 16) & 0xff;
  b[i++] = (tl >>> 8) & 0xff;
  b[i++] = tl & 0xff;

  const tmh = ((msecs / 0x100000000) * 10000) & 0xfffffff;
  b[i++] = (tmh >>> 8) & 0xff;
  b[i++] = tmh & 0xff;

  b[i++] = ((tmh >>> 24) & 0xf) | 0x10;
  b[i++] = (tmh >>> 16) & 0xff;

  b[i++] = (clockseq >>> 8) | 0x80;

  b[i++] = clockseq & 0xff;

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ?? bytesToUuid(b);
}
