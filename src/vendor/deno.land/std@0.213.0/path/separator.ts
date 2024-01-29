// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { isWindows } from "./_os.ts";

/**
 * @deprecated (will be removed in 0.215.0) Use {@linkcode SEPARATOR} from {@link https://deno.land/std/path/constants.ts} instead.
 */
export const SEP: "/" | "\\" = isWindows ? "\\" : "/";
/**
 * @deprecated (will be removed in 0.215.0) Use {@linkcode SEPARATOR_PATTERN} from {@link https://deno.land/std/path/constants.ts} instead.
 */
export const SEP_PATTERN: RegExp = isWindows ? /[\\/]+/ : /\/+/;
