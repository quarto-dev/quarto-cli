// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import { BytesList } from "../bytes/bytes_list.ts";
import { createLPS } from "./_common.ts";

/** Disposition of the delimiter. */
export type DelimiterDisposition =
  /** Include delimiter in the found chunk. */
  | "suffix"
  /** Include delimiter in the subsequent chunk. */
  | "prefix"
  /** Discard the delimiter. */
  | "discard" // delimiter discarded
;

export interface DelimiterStreamOptions {
  /** Disposition of the delimiter. */
  disposition?: DelimiterDisposition;
}

/**
 * Divide a stream into chunks delimited by a given byte sequence.
 *
 * @example
 * Divide a CSV stream by commas, discarding the commas:
 * ```ts
 * import { DelimiterStream } from "https://deno.land/std@$STD_VERSION/streams/delimiter_stream.ts";
 * const res = await fetch("https://example.com/data.csv");
 * const parts = res.body!
 *   .pipeThrough(new DelimiterStream(new TextEncoder().encode(",")))
 *   .pipeThrough(new TextDecoderStream());
 * ```
 *
 * @example
 * Divide a stream after semi-colons, keeping the semi-colons in the output:
 * ```ts
 * import { DelimiterStream } from "https://deno.land/std@$STD_VERSION/streams/delimiter_stream.ts";
 * const res = await fetch("https://example.com/file.js");
 * const parts = res.body!
 *   .pipeThrough(
 *     new DelimiterStream(
 *       new TextEncoder().encode(";"),
 *       { disposition: "suffix" },
 *     )
 *   )
 *   .pipeThrough(new TextDecoderStream());
 * ```
 *
 * @param delimiter Delimiter byte sequence
 * @param options Options for the transform stream
 * @returns Transform stream
 */
export class DelimiterStream extends TransformStream<Uint8Array, Uint8Array> {
  #bufs = new BytesList();
  #delimiter: Uint8Array;
  #inspectIndex = 0;
  #matchIndex = 0;
  #delimLen: number;
  #delimLPS: Uint8Array;
  #disp?: DelimiterDisposition;

  constructor(
    delimiter: Uint8Array,
    options?: DelimiterStreamOptions,
  ) {
    super({
      transform: (chunk, controller) => {
        this.#handle(chunk, controller);
      },
      flush: (controller) => {
        controller.enqueue(this.#bufs.concat());
      },
    });

    this.#delimiter = delimiter;
    this.#delimLen = delimiter.length;
    this.#delimLPS = createLPS(delimiter);
    this.#disp = options?.disposition ?? "discard";
  }

  #handle(
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    this.#bufs.add(chunk);
    let localIndex = 0;
    while (this.#inspectIndex < this.#bufs.size()) {
      if (chunk[localIndex] === this.#delimiter[this.#matchIndex]) {
        this.#inspectIndex++;
        localIndex++;
        this.#matchIndex++;
        if (this.#matchIndex === this.#delimLen) {
          // Full match
          const start = this.#inspectIndex - this.#delimLen;
          const end = this.#disp == "suffix" ? this.#inspectIndex : start;
          const copy = this.#bufs.slice(0, end);
          controller.enqueue(copy);
          const shift = this.#disp == "prefix" ? start : this.#inspectIndex;
          this.#bufs.shift(shift);
          this.#inspectIndex = this.#disp == "prefix" ? this.#delimLen : 0;
          this.#matchIndex = 0;
        }
      } else {
        if (this.#matchIndex === 0) {
          this.#inspectIndex++;
          localIndex++;
        } else {
          this.#matchIndex = this.#delimLPS[this.#matchIndex - 1];
        }
      }
    }
  }
}
