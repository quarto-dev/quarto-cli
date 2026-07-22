/*
 * format.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kBaseFormat, kPreferHtml } from "../config/constants.ts";
import { Format, FormatPandoc } from "./types.ts";
import { parseFormatString } from "../core/pandoc/pandoc-formats.ts";

export function isPdfOutput(format: string): boolean;
export function isPdfOutput(format: FormatPandoc): boolean;
export function isPdfOutput(format: string | FormatPandoc): boolean {
  return isFormatTo(format, "pdf") || isFormatTo(format, "beamer");
}

export function isLatexOutput(format: FormatPandoc) {
  return ["pdf", "latex", "beamer"].some((fmt) => isFormatTo(format, fmt));
}

export function isTypstOutput(format: string): boolean;
export function isTypstOutput(format: FormatPandoc): boolean;
export function isTypstOutput(format: string | FormatPandoc) {
  return isFormatTo(format, "typst");
}

export function isBeamerOutput(format: FormatPandoc) {
  return isFormatTo(format, "beamer");
}

export function isEpubOutput(format: string): boolean;
export function isEpubOutput(format: FormatPandoc): boolean;
export function isEpubOutput(format: string | FormatPandoc): boolean {
  if (typeof format !== "string") {
    format = format?.to || "html";
  }
  return ["epub", "epub2", "epub3"].some((fmt) => isFormatTo(format, fmt));
}

export function isDocxOutput(format: string): boolean;
export function isDocxOutput(format: FormatPandoc): boolean;
export function isDocxOutput(format: string | FormatPandoc): boolean {
  return isFormatTo(format, "docx");
}

export function isHtmlFileOutput(format: string): boolean;
export function isHtmlFileOutput(format: FormatPandoc): boolean;
export function isHtmlFileOutput(format?: string | FormatPandoc): boolean {
  if (typeof format !== "string") {
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
  if (typeof format !== "string") {
    format = format?.to;
  }
  format = format || "html";
  if (
    isHtmlDocOutput(format) || isHtmlDashboardOutput(format)
  ) {
    return true;
  } else if (!strict) {
    return isHtmlSlideOutput(format) || isEpubOutput(format);
  } else {
    return false;
  }
}

export function isHtmlDocOutput(format: string | FormatPandoc) {
  return ["html", "html4", "html5"].some((fmt) => isFormatTo(format, fmt));
}

export function isHtmlSlideOutput(format: string | FormatPandoc) {
  return [
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
  ].some((fmt) => isFormatTo(format, fmt));
}

// Dashboard uses pandoc.to="html", so pass format.identifier["base-format"]
// (not format.pandoc.to) when checking from a Format object.
export function isHtmlDashboardOutput(format?: string) {
  return format === "dashboard" || format?.endsWith("-dashboard");
}

export function isJatsOutput(format?: string | FormatPandoc) {
  if (typeof format !== "string") {
    format = format?.to || "html";
  }

  const jatsFormats = [
    "jats",
    "jats_archiving",
    "jats_articleauthoring",
    "jats_publishing",
  ];
  const formatStr = format as string;
  if (jatsFormats.some((f) => formatStr.startsWith(f))) return true;
  try {
    const base = parseFormatString(formatStr).baseFormat;
    return jatsFormats.some((f) => base.startsWith(f));
  } catch {
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

export function isRevealjsOutput(format: string): boolean;
export function isRevealjsOutput(format: FormatPandoc): boolean;
export function isRevealjsOutput(format?: string | FormatPandoc) {
  if (typeof format !== "string") {
    format = format?.to;
  }
  format = format || "html";
  if (format.startsWith("revealjs")) return true;
  try {
    return parseFormatString(format).baseFormat.startsWith("revealjs");
  } catch {
    return false;
  }
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

function isFormatTo(format: string | FormatPandoc, to: string) {
  const formatStr = typeof format === "string"
    ? format
    : (format?.to || "html");
  if (formatStr.startsWith(to)) return true;
  try {
    return parseFormatString(formatStr).baseFormat.startsWith(to);
  } catch {
    return false;
  }
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
