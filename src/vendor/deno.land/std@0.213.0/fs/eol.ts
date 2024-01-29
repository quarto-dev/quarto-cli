// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/** End-of-line character for POSIX platforms such as macOS and Linux. */
export const LF = "\n" as const;

/** End-of-line character for Windows platforms. */
export const CRLF = "\r\n" as const;

/**
 * End-of-line character evaluated for the current platform.
 *
 * @example
 * ```ts
 * import { EOL } from "https://deno.land/std@$STD_VERSION/fs/eol.ts";
 *
 * EOL; // Returns "\n" on POSIX platforms or "\r\n" on Windows
 * ```
 */
export const EOL: "\n" | "\r\n" = Deno?.build.os === "windows" ? CRLF : LF;

const regDetect = /(?:\r?\n)/g;

/**
 * Detect the EOL character for string input.
 * returns null if no newline.
 *
 * @example
 * ```ts
 * import { detect, EOL } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * const CRLFinput = "deno\r\nis not\r\nnode";
 * const Mixedinput = "deno\nis not\r\nnode";
 * const LFinput = "deno\nis not\nnode";
 * const NoNLinput = "deno is not node";
 *
 * detect(LFinput); // output EOL.LF
 * detect(CRLFinput); // output EOL.CRLF
 * detect(Mixedinput); // output EOL.CRLF
 * detect(NoNLinput); // output null
 * ```
 */
export function detect(content: string): typeof EOL | null {
  const d = content.match(regDetect);
  if (!d || d.length === 0) {
    return null;
  }
  const hasCRLF = d.some((x: string): boolean => x === CRLF);

  return hasCRLF ? CRLF : LF;
}

/**
 * Format the file to the targeted EOL.
 *
 * @example
 * ```ts
 * import { LF, format } from "https://deno.land/std@$STD_VERSION/fs/mod.ts";
 *
 * const CRLFinput = "deno\r\nis not\r\nnode";
 *
 * format(CRLFinput, LF); // output "deno\nis not\nnode"
 * ```
 */
export function format(content: string, eol: typeof EOL): string {
  return content.replace(regDetect, eol);
}
