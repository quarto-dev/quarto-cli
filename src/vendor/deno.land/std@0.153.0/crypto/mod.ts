// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/**
 * Extensions to the
 * [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
 * supporting additional encryption APIs.
 *
 * Provides additional digest algorithms that are not part of the WebCrypto
 * standard as well as a `subtle.digest` and `subtle.digestSync` methods. It
 * also provide a `subtle.timingSafeEqual()` method to compare array buffers
 * or data views in a way that isn't prone to timing based attacks.
 *
 * The "polyfill" delegates to `WebCrypto` where possible.
 *
 * The {@linkcode KeyStack} export implements the {@linkcode KeyRing} interface
 * for managing rotatable keys for signing data to prevent tampering, like with
 * HTTP cookies.
 *
 * @module
 */

import {
  DigestAlgorithm as WasmDigestAlgorithm,
  digestAlgorithms as wasmDigestAlgorithms,
  instantiateWasm,
} from "../_wasm_crypto/mod.ts";
import { timingSafeEqual } from "./timing_safe_equal.ts";
import { fnv } from "./_fnv/index.ts";

export { type Data, type Key, KeyStack } from "./keystack.ts";

/**
 * A copy of the global WebCrypto interface, with methods bound so they're
 * safe to re-export.
 */
const webCrypto = ((crypto) => ({
  getRandomValues: crypto.getRandomValues?.bind(crypto),
  randomUUID: crypto.randomUUID?.bind(crypto),
  subtle: {
    decrypt: crypto.subtle?.decrypt?.bind(crypto.subtle),
    deriveBits: crypto.subtle?.deriveBits?.bind(crypto.subtle),
    deriveKey: crypto.subtle?.deriveKey?.bind(crypto.subtle),
    digest: crypto.subtle?.digest?.bind(crypto.subtle),
    encrypt: crypto.subtle?.encrypt?.bind(crypto.subtle),
    exportKey: crypto.subtle?.exportKey?.bind(crypto.subtle),
    generateKey: crypto.subtle?.generateKey?.bind(crypto.subtle),
    importKey: crypto.subtle?.importKey?.bind(crypto.subtle),
    sign: crypto.subtle?.sign?.bind(crypto.subtle),
    unwrapKey: crypto.subtle?.unwrapKey?.bind(crypto.subtle),
    verify: crypto.subtle?.verify?.bind(crypto.subtle),
    wrapKey: crypto.subtle?.wrapKey?.bind(crypto.subtle),
  },
}))(globalThis.crypto);

const bufferSourceBytes = (data: BufferSource | unknown) => {
  let bytes: Uint8Array | undefined;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  }
  return bytes;
};

/** Extensions to the web standard `SubtleCrypto` interface. */
export interface StdSubtleCrypto extends SubtleCrypto {
  /**
   * Returns a new `Promise` object that will digest `data` using the specified
   * `AlgorithmIdentifier`.
   */
  digest(
    algorithm: DigestAlgorithm,
    data: BufferSource | AsyncIterable<BufferSource> | Iterable<BufferSource>,
  ): Promise<ArrayBuffer>;

  /**
   * Returns a ArrayBuffer with the result of digesting `data` using the
   * specified `AlgorithmIdentifier`.
   */
  digestSync(
    algorithm: DigestAlgorithm,
    data: BufferSource | Iterable<BufferSource>,
  ): ArrayBuffer;

  /** Compare to array buffers or data views in a way that timing based attacks
   * cannot gain information about the platform. */
  timingSafeEqual(
    a: ArrayBufferLike | DataView,
    b: ArrayBufferLike | DataView,
  ): boolean;
}

/** Extensions to the Web {@linkcode Crypto} interface. */
export interface StdCrypto extends Crypto {
  readonly subtle: StdSubtleCrypto;
}

/**
 * An wrapper for WebCrypto adding support for additional non-standard
 * algorithms, but delegating to the runtime WebCrypto implementation whenever
 * possible.
 */
const stdCrypto: StdCrypto = ((x) => x)({
  ...webCrypto,
  subtle: {
    ...webCrypto.subtle,

    async digest(
      algorithm: DigestAlgorithm,
      data: BufferSource | AsyncIterable<BufferSource> | Iterable<BufferSource>,
    ): Promise<ArrayBuffer> {
      const { name, length } = normalizeAlgorithm(algorithm);
      const bytes = bufferSourceBytes(data);

      if (FNVAlgorithms.includes(name)) {
        return fnv(name, bytes);
      }

      // We delegate to WebCrypto whenever possible,
      if (
        // if the algorithm is supported by the WebCrypto standard,
        (webCryptoDigestAlgorithms as readonly string[]).includes(name) &&
        // and the data is a single buffer,
        bytes
      ) {
        return webCrypto.subtle.digest(algorithm, bytes);
      } else if (wasmDigestAlgorithms.includes(name as WasmDigestAlgorithm)) {
        if (bytes) {
          // Otherwise, we use our bundled Wasm implementation via digestSync
          // if it supports the algorithm.
          return stdCrypto.subtle.digestSync(algorithm, bytes);
        } else if ((data as Iterable<BufferSource>)[Symbol.iterator]) {
          return stdCrypto.subtle.digestSync(
            algorithm,
            data as Iterable<BufferSource>,
          );
        } else if (
          (data as AsyncIterable<BufferSource>)[Symbol.asyncIterator]
        ) {
          const wasmCrypto = instantiateWasm();
          const context = new wasmCrypto.DigestContext(name);
          for await (const chunk of data as AsyncIterable<BufferSource>) {
            const chunkBytes = bufferSourceBytes(chunk);
            if (!chunkBytes) {
              throw new TypeError("data contained chunk of the wrong type");
            }
            context.update(chunkBytes);
          }
          return context.digestAndDrop(length).buffer;
        } else {
          throw new TypeError(
            "data must be a BufferSource or [Async]Iterable<BufferSource>",
          );
        }
      } else if (webCrypto.subtle?.digest) {
        // (TypeScript type definitions prohibit this case.) If they're trying
        // to call an algorithm we don't recognize, pass it along to WebCrypto
        // in case it's a non-standard algorithm supported by the the runtime
        // they're using.
        return webCrypto.subtle.digest(
          algorithm,
          (data as unknown) as Uint8Array,
        );
      } else {
        throw new TypeError(`unsupported digest algorithm: ${algorithm}`);
      }
    },

    digestSync(
      algorithm: DigestAlgorithm,
      data: BufferSource | Iterable<BufferSource>,
    ): ArrayBuffer {
      algorithm = normalizeAlgorithm(algorithm);

      const bytes = bufferSourceBytes(data);

      if (FNVAlgorithms.includes(algorithm.name)) {
        return fnv(algorithm.name, bytes);
      }

      const wasmCrypto = instantiateWasm();
      if (bytes) {
        return wasmCrypto.digest(algorithm.name, bytes, algorithm.length)
          .buffer;
      } else if ((data as Iterable<BufferSource>)[Symbol.iterator]) {
        const context = new wasmCrypto.DigestContext(algorithm.name);
        for (const chunk of data as Iterable<BufferSource>) {
          const chunkBytes = bufferSourceBytes(chunk);
          if (!chunkBytes) {
            throw new TypeError("data contained chunk of the wrong type");
          }
          context.update(chunkBytes);
        }
        return context.digestAndDrop(algorithm.length).buffer;
      } else {
        throw new TypeError(
          "data must be a BufferSource or Iterable<BufferSource>",
        );
      }
    },

    // TODO(@kitsonk): rework when https://github.com/w3c/webcrypto/issues/270 resolved
    timingSafeEqual,
  },
});

const FNVAlgorithms = ["FNV32", "FNV32A", "FNV64", "FNV64A"];

/** Digest algorithms supported by WebCrypto. */
const webCryptoDigestAlgorithms = [
  "SHA-384",
  "SHA-256",
  "SHA-512",
  // insecure (length-extendable and collidable):
  "SHA-1",
] as const;

type FNVAlgorithms = "FNV32" | "FNV32A" | "FNV64" | "FNV64A";
type DigestAlgorithmName = WasmDigestAlgorithm | FNVAlgorithms;

type DigestAlgorithmObject = {
  name: DigestAlgorithmName;
  length?: number;
};

type DigestAlgorithm = DigestAlgorithmName | DigestAlgorithmObject;

const normalizeAlgorithm = (algorithm: DigestAlgorithm) =>
  ((typeof algorithm === "string") ? { name: algorithm.toUpperCase() } : {
    ...algorithm,
    name: algorithm.name.toUpperCase(),
  }) as DigestAlgorithmObject;

export { stdCrypto as crypto };
