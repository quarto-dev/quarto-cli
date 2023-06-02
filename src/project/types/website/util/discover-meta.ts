/*
 * discover-meta.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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

export function findDescription(doc: Document): string | undefined {
  const paras = doc.querySelectorAll(
    "main.content > p,  main.content > section > p",
  );
  for (const para of paras) {
    const paraEl = para as Element;
    if (paraEl.innerText) {
      return paraEl.innerText;
    }
  }
  return undefined;
}

export function findPreviewImg(
  doc: Document,
  strict: boolean,
): string | undefined {
  const imgEl = findPreviewImgEl(doc, strict);
  if (imgEl) {
    const src = getDecodedAttribute(imgEl, "src");
    if (src !== null) {
      return src;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

export function findPreviewImgEl(
  doc: Document,
  strict: boolean,
): Element | undefined {
  // look for an image explicitly marked as the preview image (.class .preview-image)
  const match = doc.querySelector(`img.${kPreviewImgClass}`);
  if (match) {
    return match;
  }

  const codeMatch = doc.querySelector(
    `div.${kPreviewImgClass} div.cell-output-display img`,
  );
  if (codeMatch) {
    return codeMatch;
  }

  // look for an image with name feature, cover, or thumbnail
  const imgs = doc.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i] as Element;
    const src = getDecodedAttribute(img, "src");
    if (src !== null && kNamedFileRegex.test(src)) {
      return img;
    }
  }

  // as a last resort, just use the auto-discovered image from the lua
  // filter chain, if it exists
  if (!strict) {
    const autoImg = doc.querySelector("#quarto-document-content img");
    if (autoImg) {
      return autoImg;
    }
  }
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
    return Math.ceil(wordCount / kWpm);
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
