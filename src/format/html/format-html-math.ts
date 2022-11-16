/*
* format-html-math.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import { Document } from "../../core/deno-dom.ts";

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
