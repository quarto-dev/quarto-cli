/*
* html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { generate as generateUuid } from "uuid/v4.ts";

import {
  Document,
  Element,
  initParser,
} from "deno_dom/deno-dom-wasm-noinit.ts";

import { pandocAutoIdentifier } from "./pandoc/pandoc-id.ts";
import { isFileRef } from "./http.ts";
import { cssFileRefs } from "./css.ts";

// one time init
// deno-lint-ignore camelcase
let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (!s_DenoDomInitialized) {
    await initParser();
    s_DenoDomInitialized = true;
  }
}

export function asHtmlId(text: string) {
  return pandocAutoIdentifier(text, false);
}

export function getDecodedAttribute(element: Element, attrib: string) {
  const value = element.getAttribute(attrib);
  if (value) {
    return decodeURI(value);
  } else {
    return value;
  }
}

export const kHtmlResourceTags: Record<string, string[]> = {
  "a": ["href"],
  "img": ["src", "data-src"],
  "link": ["href"],
  "script": ["src"],
  "embed": ["src"],
  "iframe": ["src"],
  "section": ["data-background-image", "data-background-video"],
};

export function discoverResourceRefs(doc: Document): Promise<string[]> {
  // first handle tags
  const refs: string[] = [];
  Object.keys(kHtmlResourceTags).forEach((tag) => {
    for (const attrib of kHtmlResourceTags[tag]) {
      refs.push(...resolveResourceTag(doc, tag, attrib));
    }
  });
  // css references (import/url)
  const styles = doc.querySelectorAll("style");
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i] as Element;
    if (style.innerHTML) {
      refs.push(...cssFileRefs(style.innerHTML));
    }
  }
  return Promise.resolve(refs);
}

export function processFileResourceRefs(
  doc: Document,
  tag: string,
  attrib: string,
  onRef: (tag: Element, ref: string) => void,
) {
  const tags = doc.querySelectorAll(tag);
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i] as Element;
    const href = getDecodedAttribute(tag, attrib);
    if (href !== null && href.length > 0 && isFileRef(href)) {
      onRef(tag, href);
    }
  }
}

function resolveResourceTag(
  doc: Document,
  tag: string,
  attrib: string,
) {
  const refs: string[] = [];
  processFileResourceRefs(
    doc,
    tag,
    attrib,
    (_tag: Element, ref: string) => refs.push(ref),
  );
  return refs;
}

export function placeholderHtml(context: string, html: string) {
  return `${beginPlaceholder(context)}\n${html}\n${endPlaceholder(context)}`;
}

export function fillPlaceholderHtml(
  html: string,
  context: string,
  content: string,
) {
  const begin = beginPlaceholder(context);
  const beginPos = html.indexOf(begin);
  const end = endPlaceholder(context);
  const endPos = html.indexOf(end);

  if (beginPos !== -1 && endPos !== -1) {
    return html.slice(0, beginPos + begin.length) + "\n" + content + "\n" +
      html.slice(endPos);
  } else {
    return html;
  }
}

export function preservePlaceholders(
  html: string,
) {
  const placeholders = new Map<string, string>();
  html = html.replaceAll(/<!--\/?quarto-placeholder-.*?-->/g, (match) => {
    const id = generateUuid();
    placeholders.set(id, match);
    return id;
  });
  return { html, placeholders };
}

export function restorePlaceholders(
  html: string,
  placeholders: Map<string, string>,
) {
  placeholders.forEach((value, key) => {
    html = html.replace(key, value);
  });
  return html;
}

function beginPlaceholder(context: string) {
  return `<!--${placeholderTag(context)}-->`;
}

function endPlaceholder(context: string) {
  return `<!--/${placeholderTag(context)}-->`;
}

function placeholderTag(context: string) {
  return `quarto-placeholder-${context}`;
}
