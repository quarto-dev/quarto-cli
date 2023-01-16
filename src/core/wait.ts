/*
* wait.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
