/*
 * ansi-colors.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { AnsiUp } from "ansi_up";
import { Element, parseHtml } from "./deno-dom.ts";

export function hasAnsiEscapeCodes(str: string) {
  // deno-lint-ignore no-control-regex
  return !!str.match(/\x1b\[\d+(?:;\d+)*m/);
}

export async function convertToHtmlSpans(str: string) {
  const a = new AnsiUp();
  a.use_classes = true;
  const html = a.ansi_to_html(str);

  // wrap in pre so deno-dom preserves whitespace
  const doc = await parseHtml(`<pre>${html}</pre>`);
  for (const node of doc.querySelectorAll("span")) {
    const el = node as Element;
    if (el.getAttribute("style") === "font-weight:bold") {
      el.removeAttribute("style");
      el.classList.add("ansi-bold");
    }
  }
  return doc.querySelector("pre")!.innerHTML;
}
