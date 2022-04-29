/*
* discover-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { getDecodedAttribute } from "../../../../core/html.ts";

// Image discovery happens by either:
// Finding an image with the class 'preview-image'
// Finding an image with a magic name
// In the case of MD, just finding the first image and using that

const kPreviewImgClass = "preview-image";
const kNamedFilePattern =
  "(.*?(?:preview|feature|cover|thumbnail).*?(?:\\.png|\\.gif|\\.jpg|\\.jpeg|\\.webp))";
const kPreviewClassPattern =
  `!\\[[^\\]]*\\]\\((.*?)(?:\\".*\\")?\\)\\{[^\\|]*\\.${kPreviewImgClass}[\\s\\}]+`;
const kMdNamedImagePattern =
  `!\\[[^\\]]*\\]\\(${kNamedFilePattern}(?:\\".*\\")?\\)(?:\\{[^\\|]*\.*[\\s\\}]+)?`;

const kNamedFileRegex = RegExp(kNamedFilePattern);
const kMdPreviewClassRegex = RegExp(kPreviewClassPattern);
const kMdNamedImageRegex = RegExp(kMdNamedImagePattern);
const kMarkdownImg = /!\[[^\]]*\]\((.*?)(?:\".*\")?\)(?:\{(?:[^\|]*)\})?/;

export function findPreviewImg(
  doc: Document,
): string | undefined {
  let image = undefined;
  // look for an image explicitly marked as the preview image (.class .preview-image)
  const match = doc.querySelector(`img.${kPreviewImgClass}`);
  if (match) {
    const src = getDecodedAttribute(match, "src");
    if (src !== null) {
      image = src;
    }
  }

  // look for an image with name feature, cover, or thumbnail
  if (image == undefined) {
    const imgs = doc.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i] as Element;
      const src = getDecodedAttribute(img, "src");
      if (src !== null && kNamedFileRegex.test(src)) {
        image = src;
        break;
      }
    }
  }

  return image;
}

// The general words per minute that we should use.
// Typical adults supposedly 200-250 WPM
// College students, 300 WPM
// Technical content can be closer to 50-100 WPM
// So 200 is a good middle ground estimate.
const kWpm = 200;
export function estimateReadingTimeMinutes(
  markdown?: string,
): number | undefined {
  if (markdown) {
    const wordCount = markdown.split(" ").length;
    return wordCount / kWpm;
  }
  return 0;
}

export function findPreviewImgMd(markdown?: string): string | undefined {
  if (markdown) {
    // Look for an explictly tagged image
    const explicitMatch = markdown.match(kMdPreviewClassRegex);
    if (explicitMatch) {
      return explicitMatch[1];
    }

    // Look for an image with a 'magic' name
    const fileNameMatch = markdown.match(kMdNamedImageRegex);
    if (fileNameMatch) {
      return fileNameMatch[1];
    }

    // Otherwise select the first image
    const match = markdown.match(kMarkdownImg);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}
