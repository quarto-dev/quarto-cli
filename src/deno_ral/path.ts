/*
 * path.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import * as path from "path";

export const SEP = path.SEPARATOR;
export const SEP_PATTERN = path.SEPARATOR_PATTERN;
export const basename = path.basename;
export const extname = path.extname;
export const dirname = path.dirname;
export const fromFileUrl = path.fromFileUrl;
export const globToRegExp = path.globToRegExp;
export const isAbsolute = path.isAbsolute;
export const join = path.join;
export const relative = path.relative;
export const resolve = path.resolve;
export const normalize = path.normalize;
export const toFileUrl = path.toFileUrl;
export const isGlob = path.isGlob;

export const posix = { normalize: path.posix.normalize };
