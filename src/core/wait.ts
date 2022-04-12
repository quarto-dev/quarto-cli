/*
* wait.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
