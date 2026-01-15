/*
 * safe-clone-deep.ts
 *
 * CloneDeep that uses object's own cloning methods when available
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

// This is used to create new interfaces that extend the Cloneable interface
// to make the object having a clone method for specific cloning behavior in safeCloneDeep.
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

  // Handle Maps
  if (obj instanceof Map) {
    const clonedMap = new Map();
    for (const [key, value] of obj.entries()) {
      clonedMap.set(key, safeCloneDeep(value));
    }
    return clonedMap as T;
  }

  // Handle Sets
  if (obj instanceof Set) {
    const clonedSet = new Set();
    for (const value of obj.values()) {
      clonedSet.add(safeCloneDeep(value));
    }
    return clonedSet as T;
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
