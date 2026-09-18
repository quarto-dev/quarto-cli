/*
 * once.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export const once = (fn: () => void) => {
  let called = false;
  return () => {
    if (!called) {
      called = true;
      fn();
    }
  };
};
