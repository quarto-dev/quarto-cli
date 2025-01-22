/*
 * json.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export const walkJson = (
  // deno-lint-ignore no-explicit-any
  obj: any,
  test: (v: unknown) => boolean,
  process: (v: unknown) => unknown,
  // deno-lint-ignore no-explicit-any
): any => {
  if (test(obj)) {
    return process(obj);
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      const result = test(v);
      if (!result) {
        walkJson(v, test, process);
      } else {
        obj[i] = walkJson(v, test, process);
      }
    }
  } else if (typeof obj === "object" && obj) {
    for (const key in obj) {
      const v = obj[key];
      const result = test(v);
      if (!result) {
        walkJson(v, test, process);
      } else {
        obj[key] = process(v);
      }
    }
  }
  return obj;
};
