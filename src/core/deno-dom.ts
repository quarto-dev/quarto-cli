/*
* deno-dom.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { debug } from "log/mod.ts";

import { initParser } from "deno_dom/deno-dom-wasm-noinit.ts";
import { register } from "deno_dom/src/parser.ts";

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
            parameters: ["pointer", "usize", "pointer"],
            result: "void",
          },
          deno_dom_parse_frag_sync: {
            parameters: ["pointer", "usize", "pointer"],
            result: "void",
          },
          deno_dom_is_big_endian: { parameters: [], result: "u32" },
          deno_dom_copy_buf: {
            parameters: ["pointer", "pointer"],
            result: "void",
          },
        } as const;
        const symbols = _symbols as DeepWriteable<typeof _symbols>;

        const dylib = Deno.dlopen(denoNativePluginPath, symbols);

        const utf8Encoder = new TextEncoder();
        const utf8Decoder = new TextDecoder();
        const usizeBytes = dylib.symbols.deno_dom_usize_len() as number;
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

        // Register parse function and return
        register(parse, parseFrag);
        return;
      }
    } catch (e) {
      debug("Error loading deno-dom-native: " + e.message);
    }
  }

  // didn't successfully load deno-dom-native, load the wasm version
  await initParser();
  s_DenoDomInitialized = true;
}

export * from "deno_dom/src/api.ts";
