/*
* website-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";
import {
  kHtmlResourceTags,
  processFileResourceRefs,
} from "../../../core/html.ts";

import { fixupCssReferences } from "../../project-resources.ts";

export function resolveResourceRefs(
  doc: Document,
  offset: string,
  forceRoot: string | null,
) {
  // refs that need to be copied
  const refs: string[] = [];

  // resolve tags with resource refs
  Object.keys(kHtmlResourceTags).forEach((tag) => {
    refs.push(
      ...resolveTag(doc, offset, tag, kHtmlResourceTags[tag], forceRoot),
    );
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
  forceRoot: string | null,
) {
  const refs: string[] = [];
  processFileResourceRefs(doc, tag, attrib, (tag: Element, href: string) => {
    if (forceRoot) {
      if (!href.startsWith("/")) {
        tag.setAttribute(attrib, forceRoot + href);
      } else if (!href.startsWith(forceRoot)) {
        tag.setAttribute(attrib, forceRoot + href.slice(1));
      }
    } else if (href.startsWith("/")) {
      href = offset + href;
      tag.setAttribute(attrib, href);
    }
    refs.push(href!);
  });
  return refs;
}
