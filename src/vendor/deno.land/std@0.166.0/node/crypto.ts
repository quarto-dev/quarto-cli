// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.

import { ERR_CRYPTO_FIPS_FORCED } from "./internal/errors.ts";
import { crypto as constants } from "./internal_binding/constants.ts";
import { getOptionValue } from "./internal/options.ts";
import {
  getFipsCrypto,
  setFipsCrypto,
  timingSafeEqual,
} from "./internal_binding/crypto.ts";
import {
  checkPrime,
  checkPrimeSync,
  generatePrime,
  generatePrimeSync,
  randomBytes,
  randomFill,
  randomFillSync,
  randomInt,
  randomUUID,
} from "./internal/crypto/random.ts";
import type {
  CheckPrimeOptions,
  GeneratePrimeOptions,
  GeneratePrimeOptionsArrayBuffer,
  GeneratePrimeOptionsBigInt,
  LargeNumberLike,
} from "./internal/crypto/random.ts";
import { pbkdf2, pbkdf2Sync } from "./internal/crypto/pbkdf2.ts";
import type {
  Algorithms,
  NormalizedAlgorithms,
} from "./internal/crypto/pbkdf2.ts";
import { scrypt, scryptSync } from "./internal/crypto/scrypt.ts";
import { hkdf, hkdfSync } from "./internal/crypto/hkdf.ts";
import {
  generateKey,
  generateKeyPair,
  generateKeyPairSync,
  generateKeySync,
} from "./internal/crypto/keygen.ts";
import type {
  BasePrivateKeyEncodingOptions,
  DSAKeyPairKeyObjectOptions,
  DSAKeyPairOptions,
  ECKeyPairKeyObjectOptions,
  ECKeyPairOptions,
  ED25519KeyPairKeyObjectOptions,
  ED25519KeyPairOptions,
  ED448KeyPairKeyObjectOptions,
  ED448KeyPairOptions,
  KeyPairKeyObjectResult,
  KeyPairSyncResult,
  RSAKeyPairKeyObjectOptions,
  RSAKeyPairOptions,
  RSAPSSKeyPairKeyObjectOptions,
  RSAPSSKeyPairOptions,
  X25519KeyPairKeyObjectOptions,
  X25519KeyPairOptions,
  X448KeyPairKeyObjectOptions,
  X448KeyPairOptions,
} from "./internal/crypto/keygen.ts";
import {
  createPrivateKey,
  createPublicKey,
  createSecretKey,
  KeyObject,
} from "./internal/crypto/keys.ts";
import type {
  AsymmetricKeyDetails,
  JsonWebKeyInput,
  JwkKeyExportOptions,
  KeyExportOptions,
  KeyObjectType,
} from "./internal/crypto/keys.ts";
import {
  DiffieHellman,
  diffieHellman,
  DiffieHellmanGroup,
  ECDH,
} from "./internal/crypto/diffiehellman.ts";
import {
  Cipheriv,
  Decipheriv,
  getCipherInfo,
  privateDecrypt,
  privateEncrypt,
  publicDecrypt,
  publicEncrypt,
} from "./internal/crypto/cipher.ts";
import type {
  Cipher,
  CipherCCM,
  CipherCCMOptions,
  CipherCCMTypes,
  CipherGCM,
  CipherGCMOptions,
  CipherGCMTypes,
  CipherKey,
  CipherOCB,
  CipherOCBOptions,
  CipherOCBTypes,
  Decipher,
  DecipherCCM,
  DecipherGCM,
  DecipherOCB,
} from "./internal/crypto/cipher.ts";
import type {
  BinaryLike,
  BinaryToTextEncoding,
  CharacterEncoding,
  ECDHKeyFormat,
  Encoding,
  HASH_DATA,
  KeyFormat,
  KeyType,
  LegacyCharacterEncoding,
  PrivateKeyInput,
  PublicKeyInput,
} from "./internal/crypto/types.ts";
import {
  Sign,
  signOneShot,
  Verify,
  verifyOneShot,
} from "./internal/crypto/sig.ts";
import type {
  DSAEncoding,
  KeyLike,
  SigningOptions,
  SignKeyObjectInput,
  SignPrivateKeyInput,
  VerifyKeyObjectInput,
  VerifyPublicKeyInput,
} from "./internal/crypto/sig.ts";
import { createHash, Hash, Hmac } from "./internal/crypto/hash.ts";
import { X509Certificate } from "./internal/crypto/x509.ts";
import type {
  PeerCertificate,
  X509CheckOptions,
} from "./internal/crypto/x509.ts";
import {
  getCiphers,
  getCurves,
  getHashes,
  secureHeapUsed,
  setEngine,
} from "./internal/crypto/util.ts";
import type { SecureHeapUsage } from "./internal/crypto/util.ts";
import Certificate from "./internal/crypto/certificate.ts";
import type { TransformOptions, WritableOptions } from "./_stream.d.ts";

const webcrypto = globalThis.crypto;
const fipsForced = getOptionValue("--force-fips");

function createCipheriv(
  algorithm: CipherCCMTypes,
  key: CipherKey,
  iv: BinaryLike,
  options: CipherCCMOptions,
): CipherCCM;
function createCipheriv(
  algorithm: CipherOCBTypes,
  key: CipherKey,
  iv: BinaryLike,
  options: CipherOCBOptions,
): CipherOCB;
function createCipheriv(
  algorithm: CipherGCMTypes,
  key: CipherKey,
  iv: BinaryLike,
  options?: CipherGCMOptions,
): CipherGCM;
function createCipheriv(
  algorithm: string,
  key: CipherKey,
  iv: BinaryLike | null,
  options?: TransformOptions,
): Cipher;
function createCipheriv(
  cipher: string,
  key: CipherKey,
  iv: BinaryLike | null,
  options?: TransformOptions,
): Cipher {
  return new Cipheriv(cipher, key, iv, options);
}

function createDecipheriv(
  algorithm: CipherCCMTypes,
  key: CipherKey,
  iv: BinaryLike,
  options: CipherCCMOptions,
): DecipherCCM;
function createDecipheriv(
  algorithm: CipherOCBTypes,
  key: CipherKey,
  iv: BinaryLike,
  options: CipherOCBOptions,
): DecipherOCB;
function createDecipheriv(
  algorithm: CipherGCMTypes,
  key: CipherKey,
  iv: BinaryLike,
  options?: CipherGCMOptions,
): DecipherGCM;
function createDecipheriv(
  algorithm: string,
  key: CipherKey,
  iv: BinaryLike | null,
  options?: TransformOptions,
): Decipher {
  return new Decipheriv(algorithm, key, iv, options);
}

function createDiffieHellman(
  primeLength: number,
  generator?: number | ArrayBufferView,
): DiffieHellman;
function createDiffieHellman(prime: ArrayBufferView): DiffieHellman;
function createDiffieHellman(
  prime: string,
  primeEncoding: BinaryToTextEncoding,
): DiffieHellman;
function createDiffieHellman(
  prime: string,
  primeEncoding: BinaryToTextEncoding,
  generator: number | ArrayBufferView,
): DiffieHellman;
function createDiffieHellman(
  prime: string,
  primeEncoding: BinaryToTextEncoding,
  generator: string,
  generatorEncoding: BinaryToTextEncoding,
): DiffieHellman;
function createDiffieHellman(
  sizeOrKey: number | string | ArrayBufferView,
  keyEncoding?: number | ArrayBufferView | BinaryToTextEncoding,
  generator?: number | ArrayBufferView | string,
  generatorEncoding?: BinaryToTextEncoding,
): DiffieHellman {
  return new DiffieHellman(
    sizeOrKey,
    keyEncoding,
    generator,
    generatorEncoding,
  );
}

function createDiffieHellmanGroup(name: string): DiffieHellmanGroup {
  return new DiffieHellmanGroup(name);
}

function createECDH(curve: string): ECDH {
  return new ECDH(curve);
}

function createHmac(
  hmac: string,
  key: string | ArrayBuffer | KeyObject,
  options?: TransformOptions,
) {
  return Hmac(hmac, key, options);
}

function createSign(algorithm: string, options?: WritableOptions): Sign {
  return new Sign(algorithm, options);
}

function createVerify(algorithm: string, options?: WritableOptions): Verify {
  return new Verify(algorithm, options);
}

function setFipsForced(val: boolean) {
  if (val) {
    return;
  }

  throw new ERR_CRYPTO_FIPS_FORCED();
}

function getFipsForced() {
  return 1;
}

Object.defineProperty(constants, "defaultCipherList", {
  value: getOptionValue("--tls-cipher-list"),
});

const getDiffieHellman = createDiffieHellmanGroup;

const getFips = fipsForced ? getFipsForced : getFipsCrypto;
const setFips = fipsForced ? setFipsForced : setFipsCrypto;

const sign = signOneShot;
const verify = verifyOneShot;

export default {
  Certificate,
  checkPrime,
  checkPrimeSync,
  Cipheriv,
  constants,
  createCipheriv,
  createDecipheriv,
  createDiffieHellman,
  createDiffieHellmanGroup,
  createECDH,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSecretKey,
  createSign,
  createVerify,
  Decipheriv,
  DiffieHellman,
  diffieHellman,
  DiffieHellmanGroup,
  ECDH,
  generateKey,
  generateKeyPair,
  generateKeyPairSync,
  generateKeySync,
  generatePrime,
  generatePrimeSync,
  getCipherInfo,
  getCiphers,
  getCurves,
  getDiffieHellman,
  getFips,
  getHashes,
  Hash,
  hkdf,
  hkdfSync,
  Hmac,
  KeyObject,
  pbkdf2,
  pbkdf2Sync,
  privateDecrypt,
  privateEncrypt,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  randomFill,
  randomFillSync,
  randomInt,
  randomUUID,
  scrypt,
  scryptSync,
  secureHeapUsed,
  setEngine,
  setFips,
  Sign,
  sign,
  timingSafeEqual,
  Verify,
  verify,
  webcrypto,
  X509Certificate,
};

export type {
  Algorithms,
  AsymmetricKeyDetails,
  BasePrivateKeyEncodingOptions,
  BinaryLike,
  BinaryToTextEncoding,
  CharacterEncoding,
  CheckPrimeOptions,
  Cipher,
  CipherCCM,
  CipherCCMOptions,
  CipherCCMTypes,
  CipherGCM,
  CipherGCMOptions,
  CipherGCMTypes,
  CipherKey,
  CipherOCB,
  CipherOCBOptions,
  CipherOCBTypes,
  Decipher,
  DecipherCCM,
  DecipherGCM,
  DecipherOCB,
  DSAEncoding,
  DSAKeyPairKeyObjectOptions,
  DSAKeyPairOptions,
  ECDHKeyFormat,
  ECKeyPairKeyObjectOptions,
  ECKeyPairOptions,
  ED25519KeyPairKeyObjectOptions,
  ED25519KeyPairOptions,
  ED448KeyPairKeyObjectOptions,
  ED448KeyPairOptions,
  Encoding,
  GeneratePrimeOptions,
  GeneratePrimeOptionsArrayBuffer,
  GeneratePrimeOptionsBigInt,
  HASH_DATA,
  JsonWebKeyInput,
  JwkKeyExportOptions,
  KeyExportOptions,
  KeyFormat,
  KeyLike,
  KeyObjectType,
  KeyPairKeyObjectResult,
  KeyPairSyncResult,
  KeyType,
  LargeNumberLike,
  LegacyCharacterEncoding,
  NormalizedAlgorithms,
  PeerCertificate,
  PrivateKeyInput,
  PublicKeyInput,
  RSAKeyPairKeyObjectOptions,
  RSAKeyPairOptions,
  RSAPSSKeyPairKeyObjectOptions,
  RSAPSSKeyPairOptions,
  SecureHeapUsage,
  SigningOptions,
  SignKeyObjectInput,
  SignPrivateKeyInput,
  VerifyKeyObjectInput,
  VerifyPublicKeyInput,
  X25519KeyPairKeyObjectOptions,
  X25519KeyPairOptions,
  X448KeyPairKeyObjectOptions,
  X448KeyPairOptions,
  X509CheckOptions,
};

export {
  Certificate,
  checkPrime,
  checkPrimeSync,
  Cipheriv,
  constants,
  createCipheriv,
  createDecipheriv,
  createDiffieHellman,
  createDiffieHellmanGroup,
  createECDH,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSecretKey,
  createSign,
  createVerify,
  Decipheriv,
  DiffieHellman,
  diffieHellman,
  DiffieHellmanGroup,
  ECDH,
  generateKey,
  generateKeyPair,
  generateKeyPairSync,
  generateKeySync,
  generatePrime,
  generatePrimeSync,
  getCipherInfo,
  getCiphers,
  getCurves,
  getDiffieHellman,
  getFips,
  getHashes,
  Hash,
  hkdf,
  hkdfSync,
  Hmac,
  KeyObject,
  pbkdf2,
  pbkdf2Sync,
  privateDecrypt,
  privateEncrypt,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  randomFill,
  randomFillSync,
  randomInt,
  randomUUID,
  scrypt,
  scryptSync,
  secureHeapUsed,
  setEngine,
  setFips,
  Sign,
  sign,
  timingSafeEqual,
  Verify,
  verify,
  webcrypto,
  X509Certificate,
};
