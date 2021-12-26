/*
* deno-dom.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { initParser } from "deno_dom/deno-dom-wasm-noinit.ts";

let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (!s_DenoDomInitialized) {
    await initParser();
    s_DenoDomInitialized = true;
  }
}

export * from "deno_dom/src/api.ts";
