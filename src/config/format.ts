/*
* format.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kPreferHtml } from "../config/constants.ts";
import { Format, FormatPandoc } from "./types.ts";

export function isPdfOutput(format: string): boolean;
export function isPdfOutput(format: FormatPandoc): boolean;
export function isPdfOutput(format: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return format === "pdf" || format === "beamer";
}

export function isLatexOutput(format: FormatPandoc) {
  return ["pdf", "latex", "beamer"].includes(format.to || "");
}

export function isBeamerOutput(format: FormatPandoc) {
  return ["beamer"].includes(format.to || "");
}

export function isEpubOutput(format: FormatPandoc) {
  return ["epub", "epub2", "epub3"].includes(format.to || "");
}

export function isDocxOutput(format: string): boolean;
export function isDocxOutput(format: FormatPandoc): boolean;
export function isDocxOutput(format: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return format === "docx";
}

export function isHtmlOutput(format: string, strict?: boolean): boolean;
export function isHtmlOutput(format: FormatPandoc, strict?: boolean): boolean;
export function isHtmlOutput(
  format?: string | FormatPandoc,
  strict?: boolean,
): boolean {
  if (typeof (format) !== "string") {
    format = format?.to;
  }
  format = format || "html";
  if (
    [
      "html",
      "html4",
      "html5",
    ].includes(format)
  ) {
    return true;
  } else if (!strict) {
    return [
      "s5",
      "dzslides",
      "slidy",
      "slideous",
      "revealjs",
      "epub",
      "epub2",
      "epub3",
    ].includes(format);
  } else {
    return false;
  }
}

export function isPresentationOutput(format: FormatPandoc) {
  if (format.to) {
    return ["s5", "dzslides", "slidy", "slideous", "revealjs", "beamer", "pptx"]
      .some((to) => format.to?.startsWith(to));
  } else {
    return false;
  }
}

export function isRevealjsOutput(format: FormatPandoc) {
  return !!format.to && format.to.startsWith("revealjs");
}

export function isIpynbOutput(format: FormatPandoc) {
  return !!format.to && format.to.startsWith("ipynb");
}

export function isMarkdownOutput(
  format: FormatPandoc,
  flavors = ["markdown", "gfm", "commonmark"],
) {
  const to = (format.to || "").replace(/[\+\-_].*$/, "");
  return flavors.includes(to) || isIpynbOutput(format);
}

export function isHtmlCompatible(format: Format) {
  return isHtmlOutput(format.pandoc) ||
    (isMarkdownOutput(format.pandoc) && format.render[kPreferHtml]) ||
    isIpynbOutput(format.pandoc);
}

export function isJavascriptCompatible(format: Format) {
  return isHtmlCompatible(format) && !isEpubOutput(format.pandoc);
}
