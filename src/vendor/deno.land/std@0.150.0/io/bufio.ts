// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

// io/bufio.ts is deprecated. See io/buffer.ts instead.

import * as buffer from "./buffer.ts";

/** @deprecated Use BufferFullError from https://deno.land/std/io/buffer.ts instead. */
export const BufferFullError = buffer.BufferFullError;
/** @deprecated Use PartialReadError from https://deno.land/std/io/buffer.ts instead. */
export const PartialReadError = buffer.PartialReadError;
/** @deprecated Use ReadLineResult from https://deno.land/std/io/buffer.ts instead. */
export type ReadLineResult = buffer.ReadLineResult;
/** @deprecated Use BufReader from https://deno.land/std/io/buffer.ts instead. */
export const BufReader = buffer.BufReader;
/** @deprecated Use BufWriter from https://deno.land/std/io/buffer.ts instead. */
export const BufWriter = buffer.BufWriter;
/** @deprecated Use BufWriterSync from https://deno.land/std/io/buffer.ts instead. */
export const BufWriterSync = buffer.BufWriterSync;
/** @deprecated Use readDelim from https://deno.land/std/io/buffer.ts instead. */
export const readDelim = buffer.readDelim;
/** @deprecated Use readStringDelim from https://deno.land/std/io/buffer.ts instead. */
export const readStringDelim = buffer.readStringDelim;
/** @deprecated Use readLines from https://deno.land/std/io/buffer.ts instead. */
export const readLines = buffer.readLines;
