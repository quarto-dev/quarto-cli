// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as hex from "../encoding/hex.ts";
import * as base64 from "../encoding/base64.ts";

const decoder = new TextDecoder();

/**
 * Converts a hash to a string with a given encoding.
 * @example
 * ```ts
 * import { crypto, toHashString } from "https://deno.land/std@$STD_VERSION/crypto/mod.ts";
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
      return decoder.decode(hex.encode(new Uint8Array(hash)));
    case "base64":
      return base64.encode(hash);
  }
}
