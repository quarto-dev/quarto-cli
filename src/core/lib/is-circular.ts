/*
 * is-circular.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

// deno-lint-ignore no-explicit-any
export const isCircular = (obj: any): unknown => {
  const objectSet = new WeakSet();
  // deno-lint-ignore no-explicit-any
  const detect = (obj: any): boolean => {
    if (obj && typeof obj === "object") {
      if (objectSet.has(obj)) {
        return true;
      }
      objectSet.add(obj);
      for (const key in obj) {
        if (Object.hasOwn(obj, key) && detect(obj[key])) {
          return true;
        }
      }
      objectSet.delete(obj);
    }
    return false;
  };
  return detect(obj);
};
