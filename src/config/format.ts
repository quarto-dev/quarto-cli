/*
 * format.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kBaseFormat, kPreferHtml } from "../config/constants.ts";
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

export function isTypstOutput(format: string): boolean;
export function isTypstOutput(format: FormatPandoc): boolean;
export function isTypstOutput(format: string | FormatPandoc) {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return format === "typst";
}

export function isBeamerOutput(format: FormatPandoc) {
  return ["beamer"].includes(format.to || "");
}

export function isEpubOutput(format: string): boolean;
export function isEpubOutput(format: FormatPandoc): boolean;
export function isEpubOutput(format: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return ["epub", "epub2", "epub3"].includes(format || "");
}

export function isDocxOutput(format: string): boolean;
export function isDocxOutput(format: FormatPandoc): boolean;
export function isDocxOutput(format: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return format === "docx";
}

export function isHtmlFileOutput(format: string): boolean;
export function isHtmlFileOutput(format: FormatPandoc): boolean;
export function isHtmlFileOutput(format?: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return isHtmlDocOutput(format) || isHtmlSlideOutput(format);
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
    isHtmlDocOutput(format)
  ) {
    return true;
  } else if (!strict) {
    return isHtmlSlideOutput(format) || isEpubOutput(format);
  } else {
    return false;
  }
}

export function isHtmlDocOutput(format?: string | FormatPandoc) {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return [
    "html",
    "html4",
    "html5",
  ].includes(format);
}

export function isHtmlSlideOutput(format?: string | FormatPandoc) {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return [
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
  ].includes(format);
}

export function isJatsOutput(format?: string | FormatPandoc) {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }

  return [
    "jats",
    "jats_archiving",
    "jats_articleauthoring",
    "jats_publishing",
  ].find((formatStr) => {
    return (format as string).startsWith(formatStr);
  });
}

export function isPresentationOutput(format: FormatPandoc) {
  if (format.to) {
    return ["s5", "dzslides", "slidy", "slideous", "revealjs", "beamer", "pptx"]
      .some((to) => format.to?.startsWith(to));
  } else {
    return false;
  }
}

export function isRevealjsOutput(format: string): boolean;
export function isRevealjsOutput(format: FormatPandoc): boolean;
export function isRevealjsOutput(format?: string | FormatPandoc) {
  if (typeof (format) !== "string") {
    format = format?.to;
  }
  format = format || "html";
  return format.startsWith("revealjs");
}

export function isNativeOutput(format: FormatPandoc) {
  return isFormatTo(format, "native");
}

export function isJsonOutput(format: FormatPandoc) {
  return isFormatTo(format, "json");
}

export function isAstOutput(format: FormatPandoc) {
  return isNativeOutput(format) || isJsonOutput(format);
}

export function isIpynbOutput(format: FormatPandoc) {
  return isFormatTo(format, "ipynb");
}

function isFormatTo(format: FormatPandoc, to: string) {
  return !!format.to && format.to.startsWith(to);
}

export function isMarkdownOutput(
  format: Format,
  flavors = [
    "markdown",
    "markdown_github",
    "markdown_mmd",
    "markdown_phpextra",
    "markdown_strict",
    "gfm",
    "commonmark",
    "commonmark_x",
    "markua",
  ],
) {
  const to = format.identifier[kBaseFormat] || "html";
  return flavors.includes(to) || isIpynbOutput(format.pandoc);
}

export function isHtmlCompatible(format: Format) {
  return isHtmlOutput(format.pandoc) ||
    (isMarkdownOutput(format) && format.render[kPreferHtml]) ||
    isIpynbOutput(format.pandoc);
}

export function isJavascriptCompatible(format: Format) {
  return isHtmlCompatible(format) && !isEpubOutput(format.pandoc);
}
