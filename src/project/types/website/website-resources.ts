/*
* website-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { fixupCssReferences } from "../../project-resources.ts";

export function resolveResourceRefs(doc: Document, offset: string) {
  // refs that need to be copied
  const refs: string[] = [];

  // resolve tags with resource refs
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

  // css references (import/url)
  const styles = doc.querySelectorAll("style");
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i] as Element;
    if (style.innerHTML) {
      style.innerHTML = fixupCssReferences(
        style.innerHTML,
        offset + "/",
        (ref) => refs.push(ref),
      );
    }
  }

  // return refs
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
