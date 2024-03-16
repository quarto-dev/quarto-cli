// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.
// Ported mostly from https://github.com/browserify/path-browserify/
// This module is browser compatible.

/**
 * Utilities for working with OS-specific file paths.
 *
 * Functions from this module will automatically switch to support the path style
 * of the current OS, either `windows` for Microsoft Windows, or `posix` for
 * every other operating system, eg. Linux, MacOS, BSD etc.
 *
 * To use functions for a specific path style regardless of the current OS
 * import the modules from the platform sub directory instead.
 *
 * Example, for `posix`:
 *
 * ```ts
 * import { fromFileUrl } from "https://deno.land/std@$STD_VERSION/path/posix/from_file_url.ts";
 * const p = fromFileUrl("file:///home/foo");
 * console.log(p); // "/home/foo"
 * ```
 *
 * or, for `windows`:
 *
 * ```ts
 * import { fromFileUrl } from "https://deno.land/std@$STD_VERSION/path/windows/from_file_url.ts";
 * const p = fromFileUrl("file:///home/foo");
 * console.log(p); // "\\home\\foo"
 * ```
 *
 * This module is browser compatible.
 *
 * @module
 */

import { isWindows } from "./_os.ts";
import * as _windows from "./windows/mod.ts";
import * as _posix from "./posix/mod.ts";

/** @deprecated (will be removed after 1.0.0) Import from `path/windows/mod.ts` instead. */
export const win32 = _windows;

/** @deprecated (will be removed after 1.0.0) Import from `path/posix/mod.ts` instead. */
export const posix = _posix;

export const sep = isWindows ? _windows.sep : _posix.sep;
export const delimiter = isWindows ? _windows.delimiter : _posix.delimiter;

export * from "./basename.ts";
export * from "./dirname.ts";
export * from "./extname.ts";
export * from "./format.ts";
export * from "./from_file_url.ts";
export * from "./is_absolute.ts";
export * from "./join.ts";
export * from "./normalize.ts";
export * from "./parse.ts";
export * from "./relative.ts";
export * from "./resolve.ts";
export * from "./to_file_url.ts";
export * from "./to_namespaced_path.ts";
export * from "./common.ts";
export * from "./separator.ts";
export * from "./_interface.ts";
export * from "./glob.ts";
