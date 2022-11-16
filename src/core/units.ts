/*
* units.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

export function inInches(size: string): number {
  if (size.endsWith("in")) {
    return Number(size.slice(0, -2));
  }
  if (size.endsWith("pt") || size.endsWith("px")) {
    // assume 96 dpi for now
    return Number(size.slice(0, -2)) / 96;
  }
  return Number(size);
}
