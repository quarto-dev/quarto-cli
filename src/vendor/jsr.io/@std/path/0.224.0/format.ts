// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { isWindows } from "./_os.ts";
import { format as posixFormat } from "./posix/format.ts";
import { format as windowsFormat } from "./windows/format.ts";
import type { FormatInputPathObject } from "./_interface.ts";

/**
 * Generate a path from `FormatInputPathObject` object. It does the opposite
 * of `parse`.
 *
 * @param pathObject with path
 */
export function format(pathObject: FormatInputPathObject): string {
  return isWindows ? windowsFormat(pathObject) : posixFormat(pathObject);
}
