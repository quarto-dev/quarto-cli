/*
 * deno-dom.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { debug } from "../deno_ral/log.ts";

import { HTMLDocument, initParser } from "deno_dom/deno-dom-wasm-noinit.ts";
import { register } from "deno_dom/src/parser.ts";
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

export async function writeDomToHtmlFile(
  doc: HTMLDocument,
  path: string,
  doctype?: string,
) {
  if (doc.documentElement === null) {
    throw new Error("Document has no root element");
  }
  const output = doctype
    ? doctype + "\n" + doc.documentElement.outerHTML
    : doc.documentElement.outerHTML;
  await Deno.writeTextFile(path, output);
}

// We are combining a number of scripts from
// https://github.com/b-fuze/deno-dom/blob/master/deno-dom-native.ts
// into this. If deno-dom fails, it's likely that this needs to be brought up to date.

// 2022-08-26: cscheid changed this to match commit a69551336f37cd4010032e039231d926e1a4774c
// 2023-02-06: jjallaire confirmed that this is up to date as of commit e18ab07fd6e23f1e32ffd77fb4c0f92fadb81b87

let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (!s_DenoDomInitialized) {
    try {
      // try to load the native plugin
      const denoNativePluginPath = Deno.env.get("DENO_DOM_PLUGIN");
      if (denoNativePluginPath) {
        // These types are only to deal with `as const` `readonly` shenanigans
        type DeepWriteable<T> = {
          -readonly [P in keyof T]: DeepWriteable<T[P]>;
        };
        const _symbols = {
          deno_dom_usize_len: { parameters: [], result: "usize" },
          deno_dom_parse_sync: {
            parameters: ["buffer", "usize", "buffer"],
            result: "void",
          },
          deno_dom_parse_frag_sync: {
            parameters: ["buffer", "usize", "buffer"],
            result: "void",
          },
          deno_dom_is_big_endian: { parameters: [], result: "u32" },
          deno_dom_copy_buf: {
            parameters: ["buffer", "buffer"],
            result: "void",
          },
        } as const;
        const symbols = _symbols as DeepWriteable<typeof _symbols>;

        const dylib = Deno.dlopen(denoNativePluginPath, symbols);

        const utf8Encoder = new TextEncoder();
        const utf8Decoder = new TextDecoder();
        const usizeBytes = Number(dylib.symbols.deno_dom_usize_len());
        const isBigEndian = Boolean(
          dylib.symbols.deno_dom_is_big_endian() as number,
        );

        const dylibParseSync = dylib.symbols.deno_dom_parse_sync.bind(
          dylib.symbols,
        );
        const dylibParseFragSync = dylib.symbols.deno_dom_parse_frag_sync.bind(
          dylib.symbols,
        );

        // Reused for each invocation. Not thread safe, but JS isn't multithreaded
        // anyways.
        const returnBufSizeLenRaw = new ArrayBuffer(usizeBytes * 2);
        const returnBufSizeLen = new Uint8Array(returnBufSizeLenRaw);

        const genericParse = (
          parser: (
            srcBuf: Uint8Array,
            srcLength: number,
            returnBuf: Uint8Array,
          ) => void,
          srcHtml: string,
        ): string => {
          const encodedHtml = utf8Encoder.encode(srcHtml);
          parser(encodedHtml, encodedHtml.length, returnBufSizeLen);

          const outBufSize = Number(
            new DataView(returnBufSizeLenRaw).getBigUint64(0, !isBigEndian),
          );
          const outBuf = new Uint8Array(outBufSize);
          dylib.symbols.deno_dom_copy_buf(
            returnBufSizeLen.slice(usizeBytes),
            outBuf,
          );

          return utf8Decoder.decode(outBuf);
        };

        const parse = (html: string): string => {
          return genericParse(dylibParseSync, html);
        };

        const parseFrag = (html: string): string => {
          return genericParse(dylibParseFragSync, html);
        };

        debug("Loaded deno-dom-native");

        // Register parse function and return
        register(parse, parseFrag);
        s_DenoDomInitialized = true;
        return;
      }
    } catch (e) {
      debug("Error loading deno-dom-native: " + e.message);
    }
  }

  // didn't successfully load deno-dom-native, load the wasm version
  if (!s_DenoDomInitialized) {
    await initParser();
    s_DenoDomInitialized = true;
  }
}

export * from "deno_dom/src/api.ts";
export { DOMParser } from "deno_dom/src/dom/dom-parser.ts";
export { Node, NodeType } from "deno_dom/src/dom/node.ts";
