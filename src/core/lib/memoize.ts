/*
* memoize.ts
*
* Utilities to memoize functions
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

export function memoize<
  const A extends readonly unknown[] = unknown[],
  const R = unknown
>(
  f: (...args: A) => R,
  keyMemoizer: (...args: A) => string,
): (...args: A) => R {
  const memo: Record<string, R> = {};
  const inner: (...args: A) => R = (...args) => {
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
