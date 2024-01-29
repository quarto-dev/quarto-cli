// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  writeAll as _writeAll,
  writeAllSync as _writeAllSync,
} from "../io/write_all.ts";
import type { Writer, WriterSync } from "../io/types.ts";
export type { Writer, WriterSync };

/**
 * Write all the content of the array buffer (`arr`) to the writer (`w`).
 *
 * @example
 * ```ts
 * import { Buffer } from "https://deno.land/std@$STD_VERSION/io/buffer.ts";
 * import { writeAll } from "https://deno.land/std@$STD_VERSION/streams/write_all.ts";

 * // Example writing to stdout
 * let contentBytes = new TextEncoder().encode("Hello World");
 * await writeAll(Deno.stdout, contentBytes);
 *
 * // Example writing to file
 * contentBytes = new TextEncoder().encode("Hello World");
 * using file = await Deno.open('test.file', {write: true});
 * await writeAll(file, contentBytes);
 *
 * // Example writing to buffer
 * contentBytes = new TextEncoder().encode("Hello World");
 * const writer = new Buffer();
 * await writeAll(writer, contentBytes);
 * console.log(writer.bytes().length);  // 11
 * ```
 *
 * @deprecated (will be removed in 0.214.0) Import from {@link https://deno.land/std/io/write_all.ts} instead.
 */
export async function writeAll(w: Writer, arr: Uint8Array) {
  await _writeAll(w, arr);
}

/**
 * Synchronously write all the content of the array buffer (`arr`) to the
 * writer (`w`).
 *
 * ```ts
 * import { Buffer } from "https://deno.land/std@$STD_VERSION/io/buffer.ts";
 * import { writeAllSync } from "https://deno.land/std@$STD_VERSION/streams/write_all.ts";
 *
 * // Example writing to stdout
 * let contentBytes = new TextEncoder().encode("Hello World");
 * writeAllSync(Deno.stdout, contentBytes);
 *
 * // Example writing to file
 * contentBytes = new TextEncoder().encode("Hello World");
 * using file = Deno.openSync('test.file', {write: true});
 * writeAllSync(file, contentBytes);
 *
 * // Example writing to buffer
 * contentBytes = new TextEncoder().encode("Hello World");
 * const writer = new Buffer();
 * writeAllSync(writer, contentBytes);
 * console.log(writer.bytes().length);  // 11
 * ```
 *
 * @deprecated (will be removed in 0.214.0) Import from {@link https://deno.land/std/io/write_all.ts} instead.
 */
export function writeAllSync(w: WriterSync, arr: Uint8Array) {
  _writeAllSync(w, arr);
}
