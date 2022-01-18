/*
* arraty.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function asArray<T>(x?: T | Array<T>): Array<T> {
  return x ? Array.isArray(x) ? x : [x] : [];
}
