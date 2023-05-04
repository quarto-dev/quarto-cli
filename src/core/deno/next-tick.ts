/*
 * next-tick.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

export const nextTick: () => void =
  // deno-lint-ignore no-explicit-any
  (Deno as any)[(Deno as any).internal].core.setNextTickCallback;
