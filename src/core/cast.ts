/*
* cast.ts
*
* Copyright (C) 2022 Posit Software, PBC
*/

export function asNumber(x?: unknown, defaultValue = 0) {
  if (x === undefined) {
    return x;
  } else if (typeof (x) === "number") {
    return x;
  } else if (typeof (x) === "string") {
    try {
      return parseFloat(x);
    } catch {
      return defaultValue;
    }
  } else if (typeof (x) === "boolean") {
    return x ? 1 : 0;
  } else {
    return defaultValue;
  }
}
