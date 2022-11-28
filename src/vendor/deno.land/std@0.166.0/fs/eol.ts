// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Platform-specific conventions for the line ending format (i.e., the "end-of-line"). */
export enum EOL {
  /** Line Feed. Typically used in Unix (and Unix-like) systems. */
  LF = "\n",
  /** Carriage Return + Line Feed. Historically used in Windows and early DOS systems. */
  CRLF = "\r\n",
}

const regDetect = /(?:\r?\n)/g;

/**
 * Detect the EOL character for string input.
 * returns null if no newline
 */
export function detect(content: string): EOL | null {
  const d = content.match(regDetect);
  if (!d || d.length === 0) {
    return null;
  }
  const hasCRLF = d.some((x: string): boolean => x === EOL.CRLF);

  return hasCRLF ? EOL.CRLF : EOL.LF;
}

/** Format the file to the targeted EOL */
export function format(content: string, eol: EOL): string {
  return content.replace(regDetect, eol);
}
