/*
* progress.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

export function fileProgress(
  files: string[],
) {
  const numWidth = String(files.length).length;
  let i = 0;
  return {
    status: () => {
      return `[${String(i + 1).padStart(numWidth)}/${files.length}] ${
        files[i]
      }`;
    },
    next: () => {
      i++;
    },
  };
}
