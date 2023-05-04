/*
* mime.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { extname } from "path/mod.ts";

export const kTextHtml = "text/html";
export const kTextMarkdown = "text/markdown";
export const kTextLatex = "text/latex";
export const kTextPlain = "text/plain";
export const kTextXml = "text/xml";
export const kTextCss = "text/css";
export const kImagePng = "image/png";
export const kImageJpeg = "image/jpeg";
export const kImageSvg = "image/svg+xml";
export const kApplicationPdf = "application/pdf";
export const kApplicationJavascript = "application/javascript";
export const kApplicationJupyterWidgetState =
  "application/vnd.jupyter.widget-state+json";
export const kApplicationJupyterWidgetView =
  "application/vnd.jupyter.widget-view+json";
export const kDocxDocument =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const kRestructuredText = "text/restructuredtext";
export const kApplicationRtf = "application/rtf";

export function extensionForMimeImageType(
  mimeType: string,
  defaultType = "bin",
) {
  switch (mimeType) {
    case kImagePng:
      return "png";
    case kImageJpeg:
      return "jpeg";
    case kImageSvg:
      return "svg";
    case kApplicationPdf:
      return "pdf";
    default:
      return defaultType;
  }
}

export function contentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path.toLowerCase())];
}

export function isPdfContent(path?: string) {
  return !!path && contentType(path) === kApplicationPdf;
}

export function isHtmlContent(path?: string) {
  return !!path && contentType(path) === kTextHtml;
}

export function isXmlContent(path?: string) {
  return !!path && contentType(path) === kTextXml;
}

export function isMarkdownContent(path?: string) {
  return !!path && contentType(path) === kTextMarkdown;
}

export function isTextContent(path?: string) {
  return !!path &&
    (contentType(path) === kTextMarkdown ||
      contentType(path) === kTextPlain ||
      contentType(path) === kTextXml);
}


const MEDIA_TYPES: Record<string, string> = {
  ".md": kTextMarkdown,
  ".markdown": kTextMarkdown,
  ".html": kTextHtml,
  ".htm": kTextHtml,
  ".json": "application/json",
  ".map": "application/json",
  ".txt": kTextPlain,
  ".tex": kTextPlain,
  ".adoc": kTextPlain,
  ".asciidoc": kTextPlain,
  ".xml": kTextXml,
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".js": kApplicationJavascript,
  ".jsx": "text/jsx",
  ".gz": "application/gzip",
  ".css": kTextCss,
  ".wasm": "application/wasm",
  ".mjs": kApplicationJavascript,
  ".svg": kImageSvg,
  ".png": kImagePng,
  ".jpg": kImageJpeg,
  ".jpeg": kImageJpeg,
  ".pdf": kApplicationPdf,
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".textile": kTextPlain,
  ".texinfo": kTextPlain,
  ".tei": kTextPlain,
  ".rst": kTextPlain,
  ".org": kTextPlain,
  ".opml": kTextPlain,
  ".muse": kTextPlain,
  ".ms": kTextPlain,
  ".native": kTextPlain,
  ".man": kTextPlain,
  ".dokuwiki": kTextPlain,
  ".haddock": kTextPlain,
  ".icml": kTextPlain,
  ".jira": kTextPlain,
  ".mediawiki": kTextPlain,
  ".xwiki": kTextPlain,
  ".zim": kTextPlain,
  ".typ": kTextPlain,
  ".docx": kDocxDocument,
};
