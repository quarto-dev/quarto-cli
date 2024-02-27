/*
 * path.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export {
  basename,
  dirname,
  extname,
  fromFileUrl,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  SEPARATOR as SEP,
  SEPARATOR_PATTERN as SEP_PATTERN,
  toFileUrl,
} from "path/mod.ts";

export * as posix from "path/posix/mod.ts";

export { globToRegExp } from "path/glob_to_regexp.ts";
