// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

export function removeEmptyValues(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (value === null) return false;
      if (value === undefined) return false;
      if (value === "") return false;
      return true;
    }),
  );
}

export function difference(arrA: string[], arrB: string[]): string[] {
  return arrA.filter((a) => arrB.indexOf(a) < 0);
}
