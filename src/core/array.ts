/*
* array.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { MaybeArrayOf } from "../resources/types/schema-types.ts";

export function asArray<T>(x?: MaybeArrayOf<T>): Array<T> {
  return x ? Array.isArray(x) ? x : [x] : [];
}
