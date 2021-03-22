/*
* website-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

export function resolveResourceRefs(doc: Document, offset: string) {
  const refs: string[] = [];

  const tags: Record<string, string> = {
    "a": "href",
    "img": "src",
    "link": "href",
    "script": "src",
    "embed": "src",
  };

  Object.keys(tags).forEach((tag) => {
    refs.push(...resolveTag(doc, offset, tag, tags[tag]));
  });

  return refs;
}

function resolveTag(
  doc: Document,
  offset: string,
  tag: string,
  attrib: string,
) {
  const refs: string[] = [];
  const tags = doc.querySelectorAll(tag);
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i] as Element;
    const href = tag.getAttribute(attrib);
    if (href && isSiteRef(href)) {
      if (href.startsWith("/")) {
        tag.setAttribute(attrib, offset + href);
      }
      refs.push(href!);
    }
  }
  return refs;
}

function isSiteRef(href: string) {
  return !/^\w+:/.test(href) && !href.startsWith("#");
}
