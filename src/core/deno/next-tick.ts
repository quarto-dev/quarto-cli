/*
 * next-tick.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

// we currently hack nextTick through setTimeout because we don't
// want to have to import from node and the first hack attempt didn't work.
//   (Deno as any)[(Deno as any).internal].core.setNextTickCallback;

export const nextTick = (callback: () => void) => {
  // use setTimeout to emulate nextTick
  setTimeout(callback, 16); // 16ms is 1 frame at 60fps
};
