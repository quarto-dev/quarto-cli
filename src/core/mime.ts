/*
* mime.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
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
