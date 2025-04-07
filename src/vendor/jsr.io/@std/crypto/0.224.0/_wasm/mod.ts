// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
export {
  instantiate as instantiateWasm,
} from "./lib/deno_std_wasm_crypto.generated.mjs";

/**
 * All cryptographic hash/digest algorithms supported by std/crypto.
 *
 * For algorithms that are supported by WebCrypto, the name here will match the
 * one used by WebCrypto. Otherwise we prefer the formatting used in the
 * algorithm's official specification. All names are uppercase to facilitate
 * case-insensitive comparisons required by the WebCrypto spec.
 */
export const DIGEST_ALGORITHM_NAMES = [
  "BLAKE2B",
  "BLAKE2B-128",
  "BLAKE2B-160",
  "BLAKE2B-224",
  "BLAKE2B-256",
  "BLAKE2B-384",
  "BLAKE2S",
  "BLAKE3",
  "KECCAK-224",
  "KECCAK-256",
  "KECCAK-384",
  "KECCAK-512",
  "SHA-384",
  "SHA3-224",
  "SHA3-256",
  "SHA3-384",
  "SHA3-512",
  "SHAKE128",
  "SHAKE256",
  "TIGER",
  // insecure (length-extendable):
  "RIPEMD-160",
  "SHA-224",
  "SHA-256",
  "SHA-512",
  // insecure (length-extendable and collidable):
  "MD4",
  "MD5",
  "SHA-1",
  // insecure (non-cryptographic)
  "FNV32",
  "FNV32A",
  "FNV64",
  "FNV64A",
] as const;

/** An algorithm name supported by std/crypto. */
export type DigestAlgorithmName = typeof DIGEST_ALGORITHM_NAMES[number];
