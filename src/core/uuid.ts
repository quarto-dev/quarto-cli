/*
* uuid.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export function shortUuid() {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}
