/*
* wait.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
