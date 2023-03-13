// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import { createLPS } from "./_common.ts";

/** Transform a stream into a stream where each chunk is divided by a given delimiter.
 *
 * ```ts
 * import { TextDelimiterStream } from "https://deno.land/std@$STD_VERSION/streams/text_delimiter_stream.ts";
 * const res = await fetch("https://example.com");
 * const parts = res.body!
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new TextDelimiterStream("foo"));
 * ```
 */
export class TextDelimiterStream extends TransformStream<string, string> {
  #buf = "";
  #delimiter: string;
  #inspectIndex = 0;
  #matchIndex = 0;
  #delimLPS: Uint8Array;

  constructor(delimiter: string) {
    super({
      transform: (chunk, controller) => {
        this.#handle(chunk, controller);
      },
      flush: (controller) => {
        controller.enqueue(this.#buf);
      },
    });

    this.#delimiter = delimiter;
    this.#delimLPS = createLPS(new TextEncoder().encode(delimiter));
  }

  #handle(
    chunk: string,
    controller: TransformStreamDefaultController<string>,
  ) {
    this.#buf += chunk;
    let localIndex = 0;
    while (this.#inspectIndex < this.#buf.length) {
      if (chunk[localIndex] === this.#delimiter[this.#matchIndex]) {
        this.#inspectIndex++;
        localIndex++;
        this.#matchIndex++;
        if (this.#matchIndex === this.#delimiter.length) {
          // Full match
          const matchEnd = this.#inspectIndex - this.#delimiter.length;
          const readyString = this.#buf.slice(0, matchEnd);
          controller.enqueue(readyString);
          // Reset match, different from KMP.
          this.#buf = this.#buf.slice(this.#inspectIndex);
          this.#inspectIndex = 0;
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
