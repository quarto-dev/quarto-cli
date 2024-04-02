/*
 * debug.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 *
 * Debugging utilities.
 */

export const getStackAsArray = (offset?: number) => {
  return (new Error().stack ?? "").split("\n").slice(offset ?? 2);
};

export const getStack = (offset?: number) => {
  return "Stack:\n" +
    getStackAsArray(offset ? offset + 1 : 3).join("\n");
};

// use debugPrint instead of console.log so it's easy to find stray print statements
// on our codebase
//
// deno-lint-ignore no-explicit-any
export const debugPrint = (...data: any[]) => {
  console.log(...data);
};

export const debugLogWithStack = async (...data: unknown[]) => {
  const payload = {
    payload: data,
    stack: getStackAsArray(),
    timestamp: new Date().toISOString(),
  };
  await Deno.writeTextFile(
    "/tmp/stack-debug.json",
    JSON.stringify(payload) + "\n",
    {
      append: true,
    },
  );
};
