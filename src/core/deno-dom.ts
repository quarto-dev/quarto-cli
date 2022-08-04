/*
* deno-dom.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { HTMLDocument, initParser } from "deno_dom/deno-dom-wasm-noinit.ts";
import { DOMParser } from "deno_dom/src/dom/dom-parser.ts";

export async function getDomParser() {
  await initDenoDom();
  return new DOMParser();
}

export async function parseHtml(src: string): Promise<HTMLDocument> {
  await initDenoDom();
  const result = (new DOMParser()).parseFromString(src, "text/html");
  if (!result) {
    throw new Error("Couldn't parse string into HTML");
  }
  return result;
}

let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (!s_DenoDomInitialized) {
    // didn't successfully load deno-dom-native, load the wasm version
    await initParser();
    s_DenoDomInitialized = true;
  }
}

export * from "deno_dom/src/api.ts";
export { DOMParser } from "deno_dom/src/dom/dom-parser.ts";
export { NodeType } from "deno_dom/src/dom/node.ts";
