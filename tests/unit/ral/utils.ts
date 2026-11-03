/*
 * utils.ts
 *
 * Test utilities for the deno_ral unit tests
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

/** An error carrying a Node-style `code` (ENOENT, EEXIST, ...). */
export function errorWithCode(code: string): Error {
  const e = new Error(code);
  (e as Error & { code: string }).code = code;
  return e;
}
