/*
* uuid.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/

export function shortUuid() {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}
