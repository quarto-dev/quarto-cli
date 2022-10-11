/*
* uuid.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function shortUuid() {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}
