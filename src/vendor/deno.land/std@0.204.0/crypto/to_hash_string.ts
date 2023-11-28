// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { encode as hexEncode } from "../encoding/hex.ts";
import { encode as base64Encode } from "../encoding/base64.ts";

const decoder = new TextDecoder();

/**
 * @deprecated (will be removed after 0.209.0) Use `std/encoding/hex.ts` or `std/encoding/base64.ts` instead.
 *
 * Converts a hash to a string with a given encoding.
 * @example
 * ```ts
 * import { crypto } from "https://deno.land/std@$STD_VERSION/crypto/crypto.ts";
 * import { toHashString } from "https://deno.land/std@$STD_VERSION/crypto/to_hash_string.ts"
 *
 * const hash = await crypto.subtle.digest("SHA-384", new TextEncoder().encode("You hear that Mr. Anderson?"));
 *
 * // Hex encoding by default
 * console.log(toHashString(hash));
 *
 * // Or with base64 encoding
 * console.log(toHashString(hash, "base64"));
 * ```
 */
export function toHashString(
  hash: ArrayBuffer,
  encoding: "hex" | "base64" = "hex",
): string {
  switch (encoding) {
    case "hex":
      return decoder.decode(hexEncode(new Uint8Array(hash)));
    case "base64":
      return base64Encode(hash);
  }
}
