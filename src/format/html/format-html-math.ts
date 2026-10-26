/*
* format-html-math.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import { Document } from "../../core/deno-dom.ts";
import { kHtmlMathMethod } from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { MathMethods } from "../../resources/types/schema-types.ts";

export interface HtmlMathMethod {
  method: MathMethods;
  url?: string;
  // true when a command line flag (--katex, --mathjax, ...) chose the method
  fromFlag: boolean;
}

const kMathFlags = ["mathjax", "katex", "mathml", "webtex", "gladtex"] as const;

/**
 * The math method Pandoc uses for HTML output. A command line flag wins over
 * `html-math-method`, which is either a method name or `{ method, url }`.
 * Undefined when neither is set.
 */
export function resolveHtmlMathMethod(
  format: Format,
  flags?: PandocFlags,
): HtmlMathMethod | undefined {
  const flagMethod = kMathFlags.find((method) => flags?.[method]);
  if (flagMethod) {
    return { method: flagMethod, fromFlag: true };
  }
  const math = format.pandoc[kHtmlMathMethod];
  if (typeof math === "string") {
    return { method: math as MathMethods, fromFlag: false };
  }
  if (math && typeof math.method === "string") {
    return {
      method: math.method as MathMethods,
      url: math.url,
      fromFlag: false,
    };
  }
  return undefined;
}

export function katexPostProcessor() {
  return (doc: Document) => {
    // find katex elements
    const katexScript = doc.querySelector(`script[src$="katex.min.js"]`);
    const katexCss = doc.querySelector(`link[href$="katex.min.css"]`);
    if (katexScript && katexCss) {
      // strip defer
      katexScript.removeAttribute("defer");
      // before
      const katexBefore = doc.createElement("script");
      katexBefore.innerText =
        "window.backupDefine = window.define; window.define = undefined;";
      katexScript.parentNode?.insertBefore(katexBefore, katexScript);
      // after
      const katexAfter = doc.createElement("script");
      katexAfter.innerText =
        "window.define = window.backupDefine; window.backupDefine = undefined;";
      katexCss?.parentNode?.insertBefore(
        katexAfter,
        katexCss,
      );
    }

    return Promise.resolve(kHtmlEmptyPostProcessResult);
  };
}
