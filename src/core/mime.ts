/*
* mime.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

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
