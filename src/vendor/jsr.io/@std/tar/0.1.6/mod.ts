// Copyright 2018-2025 the Deno authors. MIT license.

/**
 * Streaming utilities for working with tar archives.
 *
 * Files are not compressed, only collected into the archive.
 *
 * ```ts ignore
 * import { UntarStream } from "@std/tar/untar-stream";
 * import { dirname, normalize } from "@std/path";
 *
 * for await (
 *   const entry of (await Deno.open("./out.tar.gz"))
 *     .readable
 *     .pipeThrough(new DecompressionStream("gzip"))
 *     .pipeThrough(new UntarStream())
 * ) {
 *   const path = normalize(entry.path);
 *   await Deno.mkdir(dirname(path), { recursive: true });
 *   await entry.readable?.pipeTo((await Deno.create(path)).writable);
 * }
 * ```
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 *
 * @module
 */
export * from "./tar_stream.ts";
export * from "./untar_stream.ts";
