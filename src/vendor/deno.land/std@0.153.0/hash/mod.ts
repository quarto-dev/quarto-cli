// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** **Deprecated**. Use
 * [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
 * or `std/crypto` instead.
 *
 * This module is browser compatible.
 *
 * @deprecated Use Web Crypto API or std/crypto instead.
 * @module
 */

import { Hash } from "./_wasm/hash.ts";
import type { Hasher } from "./hasher.ts";

/** @deprecated Use Web Crypto API or std/crypto instead. */
export type { Hasher } from "./hasher.ts";
/** @deprecated Use Web Crypto API or std/crypto instead. */
export const supportedAlgorithms = [
  "md2",
  "md4",
  "md5",
  "ripemd160",
  "ripemd320",
  "sha1",
  "sha224",
  "sha256",
  "sha384",
  "sha512",
  "sha3-224",
  "sha3-256",
  "sha3-384",
  "sha3-512",
  "keccak224",
  "keccak256",
  "keccak384",
  "keccak512",
  "blake3",
  "tiger",
] as const;
/** @deprecated Use Web Crypto API or std/crypto instead. */
export type SupportedAlgorithm = typeof supportedAlgorithms[number];
/**
 * Creates a new `Hash` instance.
 *
 * @param algorithm name of hash algorithm to use
 * @deprecated Use Web Crypto API or std/crypto instead.
 */
export function createHash(algorithm: SupportedAlgorithm): Hasher {
  return new Hash(algorithm as string);
}
