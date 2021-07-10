/*
* mime.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";

export const kTextHtml = "text/html";
export const kTextMarkdown = "text/markdown";
export const kTextLatex = "text/latex";
export const kTextPlain = "text/plain";
export const kImagePng = "image/png";
export const kImageJpeg = "image/jpeg";
export const kImageSvg = "image/svg+xml";
export const kApplicationPdf = "application/pdf";
export const kApplicationJavascript = "application/javascript";
export const kApplicationJupyterWidgetState =
  "application/vnd.jupyter.widget-state+json";
export const kApplicationJupyterWidgetView =
  "application/vnd.jupyter.widget-view+json";

export const kRestructuredText = "text/restructuredtext";
export const kApplicationRtf = "application/rtf";

export function extensionForMimeImageType(mimeType: string) {
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
      return "bin";
  }
}

export function contentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path.toLowerCase())];
}

export function isHtmlContent(path?: string) {
  return path && (contentType(path) === kTextHtml);
}

const MEDIA_TYPES: Record<string, string> = {
  ".md": kTextMarkdown,
  ".html": kTextHtml,
  ".htm": kTextHtml,
  ".json": "application/json",
  ".map": "application/json",
  ".txt": kTextPlain,
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".js": "application/javascript",
  ".jsx": "text/jsx",
  ".gz": "application/gzip",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".mjs": "application/javascript",
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
};
