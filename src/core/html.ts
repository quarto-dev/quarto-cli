/*
* html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { generate as generateUuid } from "uuid/v4.ts";

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
