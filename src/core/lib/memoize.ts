/*
* memoize.ts
*
* Utilities to memoize functions
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

// TODO typings for this? It's tricky because of arity and type
//       differences in the arguments
export function memoize(
  // deno-lint-ignore no-explicit-any
  f: (...args: any[]) => any,
  // deno-lint-ignore no-explicit-any
  keyMemoizer: (...args: any) => string,
  // deno-lint-ignore no-explicit-any
): ((...args: any[]) => any) {
  // deno-lint-ignore no-explicit-any
  const memo: Record<string, any> = {};
  // deno-lint-ignore no-explicit-any
  const inner: ((...args: any[]) => any) = (...args: any[]) => {
    const key = keyMemoizer(...args);
    const v = memo[key];
    if (v !== undefined) {
      return v;
    }
    memo[key] = f(...args);
    return memo[key];
  };
  return inner;
}
