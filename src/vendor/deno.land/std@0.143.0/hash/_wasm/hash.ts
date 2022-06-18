// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DenoHash, instantiate } from "./lib/deno_hash.generated.mjs";

import * as hex from "../../encoding/hex.ts";
import * as base64 from "../../encoding/base64.ts";
import type { Hasher, Message, OutputFormat } from "../hasher.ts";

export class Hash implements Hasher {
  #hash: DenoHash;
  #digested: boolean;

  constructor(algorithm: string) {
    this.#hash = instantiate().create_hash(algorithm);
    this.#digested = false;
  }

  update(message: Message): this {
    let view: Uint8Array;

    if (message instanceof Uint8Array) {
      view = message;
    } else if (typeof message === "string") {
      view = new TextEncoder().encode(message);
    } else if (ArrayBuffer.isView(message)) {
      view = new Uint8Array(
        message.buffer,
        message.byteOffset,
        message.byteLength,
      );
    } else if (message instanceof ArrayBuffer) {
      view = new Uint8Array(message);
    } else {
      throw new Error("hash: `data` is invalid type");
    }

    // Messages will be split into chunks of this size to avoid unnecessarily
    // increasing the size of the Wasm heap.

    const chunkSize = 65_536;
    const updateHash = instantiate().update_hash;

    for (
      let offset = 0;
      offset < view.byteLength;
      offset += chunkSize
    ) {
      updateHash(
        this.#hash,
        new Uint8Array(
          view.buffer,
          view.byteOffset + offset,
          Math.min(chunkSize, view.byteLength - offset),
        ),
      );
    }

    return this;
  }

  /** Returns final hash */
  digest(): ArrayBuffer {
    if (this.#digested) throw new Error("hash: already digested");

    this.#digested = true;
    return instantiate().digest_hash(this.#hash);
  }

  /**
   * Returns hash as a string of given format
   * @param format format of output string (hex or base64). Default is hex
   */
  toString(format: OutputFormat = "hex"): string {
    const finalized = new Uint8Array(this.digest());

    switch (format) {
      case "hex":
        return new TextDecoder().decode(hex.encode(finalized));
      case "base64":
        return base64.encode(finalized);
      default:
        throw new Error("hash: invalid format");
    }
  }
}
