/*
* memoize.ts
*
* Utilities to memoize functions
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// FIXME typings for this? It's tricky because of arity and type
//       differences in the arguments
export function memoize(
  f: (...args: any[]) => any,
  keyMemoizer: (...args: any) => string
): ((...args: any[]) => any)
{
  const memo: Record<string, any> = {};
  const inner: ((...args: any[]) => any) = (...args: any[]) => {
    let key = keyMemoizer(...args);
    let v = memo[key];
    if (v !== undefined) {
      return v;
    }
    memo[key] = f(...args);
    return memo[key];
  };
  return inner;
}
