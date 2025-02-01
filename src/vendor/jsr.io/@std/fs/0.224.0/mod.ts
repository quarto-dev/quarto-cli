// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Helpers for working with the filesystem.
 *
 * ```ts
 * import { ensureFile, copy, ensureDir, move } from "@std/fs";
 *
 * await ensureFile("example.txt");
 * await copy("example.txt", "example_copy.txt");
 * await ensureDir("subdir");
 * await move("example_copy.txt", "subdir/example_copy.txt");
 * ```
 *
 * @module
 */

export * from "./empty_dir.ts";
export * from "./ensure_dir.ts";
export * from "./ensure_file.ts";
export * from "./ensure_link.ts";
export * from "./ensure_symlink.ts";
export * from "./exists.ts";
export * from "./expand_glob.ts";
export * from "./move.ts";
export * from "./copy.ts";
export * from "./walk.ts";
export * from "./eol.ts";
