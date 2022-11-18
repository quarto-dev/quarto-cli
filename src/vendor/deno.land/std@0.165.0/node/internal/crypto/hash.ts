// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.

import {
  DigestAlgorithm,
  DigestContext,
  instantiateWasm,
} from "../../../crypto/_wasm/mod.ts";
import { Buffer } from "../../buffer.ts";
import { Transform } from "../../stream.ts";
import { encode as encodeToHex } from "../../../encoding/hex.ts";
import { encode as encodeToBase64 } from "../../../encoding/base64.ts";
import { encode as encodeToBase64Url } from "../../../encoding/base64url.ts";
import type { TransformOptions } from "../../_stream.d.ts";
import { validateString } from "../validators.mjs";
import { notImplemented } from "../../_utils.ts";
import type { BinaryLike, BinaryToTextEncoding, Encoding } from "./types.ts";
import { KeyObject } from "./keys.ts";

const coerceToBytes = (data: string | BufferSource): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data;
  } else if (typeof data === "string") {
    // This assumes UTF-8, which may not be correct.
    return new TextEncoder().encode(data);
  } else if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  } else {
    throw new TypeError("expected data to be string | BufferSource");
  }
};

/**
 * The Hash class is a utility for creating hash digests of data. It can be used in one of two ways:
 *
 * - As a stream that is both readable and writable, where data is written to produce a computed hash digest on the readable side, or
 * - Using the hash.update() and hash.digest() methods to produce the computed hash.
 *
 * The crypto.createHash() method is used to create Hash instances. Hash objects are not to be created directly using the new keyword.
 */
export class Hash extends Transform {
  #context: DigestContext;

  constructor(
    algorithm: string | DigestContext,
    _opts?: TransformOptions,
  ) {
    super({
      transform(chunk: string, _encoding: string, callback: () => void) {
        context.update(coerceToBytes(chunk));
        callback();
      },
      flush(callback: () => void) {
        this.push(context.digest(undefined));
        callback();
      },
    });

    if (typeof algorithm === "string") {
      // Node/OpenSSL and WebCrypto format some digest names differently;
      // we attempt to handle those here.
      algorithm = algorithm.toUpperCase();
      if (opensslToWebCryptoDigestNames[algorithm]) {
        algorithm = opensslToWebCryptoDigestNames[algorithm];
      }
      this.#context = new (instantiateWasm().DigestContext)(
        algorithm as DigestAlgorithm,
      );
    } else {
      this.#context = algorithm;
    }

    const context = this.#context;
  }

  copy(): Hash {
    return new Hash(this.#context.clone());
  }

  /**
   * Updates the hash content with the given data.
   */
  update(data: string | ArrayBuffer, _encoding?: string): this {
    let bytes;
    if (typeof data === "string") {
      data = new TextEncoder().encode(data);
      bytes = coerceToBytes(data);
    } else {
      bytes = coerceToBytes(data);
    }

    this.#context.update(bytes);

    return this;
  }

  /**
   * Calculates the digest of all of the data.
   *
   * If encoding is provided a string will be returned; otherwise a Buffer is returned.
   *
   * Supported encodings are currently 'hex', 'binary', 'base64', 'base64url'.
   */
  digest(encoding?: string): Buffer | string {
    const digest = this.#context.digest(undefined);
    if (encoding === undefined) {
      return Buffer.from(digest);
    }

    switch (encoding) {
      case "hex":
        return new TextDecoder().decode(encodeToHex(new Uint8Array(digest)));
      case "binary":
        return String.fromCharCode(...digest);
      case "base64":
        return encodeToBase64(digest);
      case "base64url":
        return encodeToBase64Url(digest);
      default:
        throw new Error(
          `The output encoding for hash digest is not implemented: ${encoding}`,
        );
    }
  }
}

export class Hmac extends Transform {
  constructor(
    hmac: string,
    _key: BinaryLike | KeyObject,
    _options?: TransformOptions,
  ) {
    validateString(hmac, "hmac");

    super();

    notImplemented("crypto.Hmac");
  }

  digest(): Buffer;
  digest(encoding: BinaryToTextEncoding): string;
  digest(_encoding?: BinaryToTextEncoding): Buffer | string {
    notImplemented("crypto.Hmac.prototype.digest");
  }

  update(data: BinaryLike): this;
  update(data: string, inputEncoding: Encoding): this;
  update(_data: BinaryLike, _inputEncoding?: Encoding): this {
    notImplemented("crypto.Hmac.prototype.update");
  }
}

/**
 * Supported digest names that OpenSSL/Node and WebCrypto identify differently.
 */
const opensslToWebCryptoDigestNames: Record<string, DigestAlgorithm> = {
  BLAKE2B256: "BLAKE2B-256",
  BLAKE2B384: "BLAKE2B-384",
  BLAKE2B512: "BLAKE2B",
  BLAKE2S256: "BLAKE2S",
  RIPEMD160: "RIPEMD-160",
  RMD160: "RIPEMD-160",
  SHA1: "SHA-1",
  SHA224: "SHA-224",
  SHA256: "SHA-256",
  SHA384: "SHA-384",
  SHA512: "SHA-512",
};

/**
 * Creates and returns a Hash object that can be used to generate hash digests
 * using the given `algorithm`. Optional `options` argument controls stream behavior.
 */
export function createHash(algorithm: string, opts?: TransformOptions) {
  return new Hash(algorithm, opts);
}

export default {
  Hash,
  Hmac,
  createHash,
};
