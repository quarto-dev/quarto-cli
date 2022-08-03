// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  copy as copy2,
  iterateReader as iterateReader2,
  iterateReaderSync as iterateReaderSync2,
  readableStreamFromIterable as readableStreamFromIterable2,
  readableStreamFromReader as readableStreamFromReader2,
  ReadableStreamFromReaderOptions as ReadableStreamFromReaderOptions2,
  readAll as readAll2,
  readAllSync as readAllSync2,
  readerFromIterable as readerFromIterable2,
  readerFromStreamReader as readerFromStreamReader2,
  writableStreamFromWriter as writableStreamFromWriter2,
  WritableStreamFromWriterOptions as WritableStreamFromWriterOptions2,
  writeAll as writeAll2,
  writeAllSync as writeAllSync2,
  writerFromStreamWriter as writerFromStreamWriter2,
} from "../streams/conversion.ts";

/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readerFromIterable = readerFromIterable2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const writerFromStreamWriter = writerFromStreamWriter2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readerFromStreamReader = readerFromStreamReader2;
/** @deprecated This interface has been moved to `/streams/conversion.ts`. */
export type WritableStreamFromWriterOptions = WritableStreamFromWriterOptions2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const writableStreamFromWriter = writableStreamFromWriter2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readableStreamFromIterable = readableStreamFromIterable2;
/** @deprecated This interface has been moved to `/streams/conversion.ts`. */
export type ReadableStreamFromReaderOptions = ReadableStreamFromReaderOptions2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readableStreamFromReader = readableStreamFromReader2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readAll = readAll2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const readAllSync = readAllSync2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const writeAll = writeAll2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const writeAllSync = writeAllSync2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const iterateReader = iterateReader2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const iterateReaderSync = iterateReaderSync2;
/** @deprecated This function has been moved to `/streams/conversion.ts`. */
export const copy = copy2;
