/*
 * path.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import * as path from "path";
import { normalize as posixNormalize } from "path/posix";

// Re-export named members from @std/path. The bare "path" specifier resolves
// at runtime via the import map but Deno's TS checker resolves its types via
// node:path compat, which lacks SEPARATOR, fromFileUrl, etc. Importing from
// "@std/path" (a non-colliding alias) preserves correct typings.
export {
  fromFileUrl,
  globToRegExp,
  isGlob,
  SEPARATOR as SEP,
  SEPARATOR_PATTERN as SEP_PATTERN,
  toFileUrl,
} from "@std/path";

export const basename = path.basename;
export const extname = path.extname;
export const dirname = path.dirname;
export const isAbsolute = path.isAbsolute;
export const join = path.join;
export const relative = path.relative;
export const resolve = path.resolve;
export const normalize = path.normalize;

export const posix = { normalize: posixNormalize };
