/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  Format,
  kHtmlPostprocessors,
  PandocFlags,
} from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat(9, 5),
    {
      metadata: {
        theme: "white",
        controlsTutorial: false,
        hash: true,
        hashOneBasedIndex: true,
        center: false,
        transition: 'none',
        backgroundTransition: 'none',
        width: 1600,
        height: 900,
        margin: 0.1,
      },
      pandoc: {
        from: 'markdown-auto_identifiers',
      },
      formatExtras: (_input: string, _flags: PandocFlags, _format: Format) => {
        return {
          html: {
            [kHtmlPostprocessors]: [revealHtmlPostprocessor()],
          },
        };
      },
    },
  );
}

function revealHtmlPostprocessor() {
  return (doc: Document): Promise<string[]> => {
    // find reveal initializatio and perform fixups
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
      const scriptEl = script as Element;
      if (
        scriptEl.innerText &&
        scriptEl.innerText.indexOf("Reveal.initialize({") !== -1
      ) {
        // quote slideNumber
        scriptEl.innerText = scriptEl.innerText.replace(
          /slideNumber: (h[\.\/]v|c(?:\/t)?)/,
          "slideNumber: '$1'",
        );
      }
    }

    return Promise.resolve([]);
  };
}
