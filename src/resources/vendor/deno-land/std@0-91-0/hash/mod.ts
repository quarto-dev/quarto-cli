// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { Hash } from "./_wasm/hash.ts";
import type { Hasher } from "./hasher.ts";

export type { Hasher } from "./hasher.ts";
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
] as const;
export type SupportedAlgorithm = typeof supportedAlgorithms[number];
/**
 * Creates a new `Hash` instance.
 *
 * @param algorithm name of hash algorithm to use
 */
export function createHash(algorithm: SupportedAlgorithm): Hasher {
  return new Hash(algorithm as string);
}
