/*
 * safe-clone-deep.ts
 *
 * CloneDeep that uses object's own cloning methods when available
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export interface Cloneable<T> {
  clone(): T;
}

export function safeCloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => safeCloneDeep(item)) as T;
  }

  if (obj && ("clone" in obj) && typeof obj.clone === "function") {
    return obj.clone();
  }

  // Handle regular objects
  const result = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = safeCloneDeep(obj[key]);
    }
  }

  return result;
}
