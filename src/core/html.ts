/*
* html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

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

function beginPlaceholder(context: string) {
  return `<!--${placeholderTag(context)}-->`;
}

function endPlaceholder(context: string) {
  return `<!--/${placeholderTag(context)}-->`;
}

function placeholderTag(context: string) {
  return `quarto-placeholder-${context}`;
}
