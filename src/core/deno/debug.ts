/*
 * debug.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 *
 * Debugging utilities.
 */

export const getStack = (offset?: number) => {
  return "Stack:\n" +
    (new Error().stack ?? "").split("\n").slice(offset ?? 2).join("\n");
};

// use debugPrint instead of console.log so it's easy to find stray print statements
// on our codebase
//
// deno-lint-ignore no-explicit-any
export const debugPrint = (...data: any[]) => {
  console.log(...data);
};
