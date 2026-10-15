/*
 * discover-meta.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { getDecodedAttribute } from "../../../../core/html.ts";
import { isDataUrl } from "../../../../core/data-url.ts";

// Image discovery happens by either:
// Finding an image with the class 'preview-image'
// Finding an image with a magic name
// In the case of MD, just finding the first image and using that

const kPreviewImgClass = "preview-image";
const kNamedFilePattern =
  "(.*?(?:preview|feature|cover|thumbnail).*?(?:\\.png|\\.gif|\\.jpg|\\.jpeg|\\.webp|\\.svg))";
const kNamedFileRegex = RegExp(kNamedFilePattern, "l");

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
): { src: string; alt?: string } | undefined {
  const imgEl = findPreviewImgEl(doc, { skipDataUrls: true });
  if (!imgEl) return undefined;

  const src = getDecodedAttribute(imgEl, "src");
  if (src === null) return undefined;

  const alt = getDecodedAttribute(imgEl, "alt");
  return {
    src,
    alt: alt ?? undefined,
  };
}

// Social metadata images are fetched by URL, so their discovery passes
// `skipDataUrls`. Listing cards are shown by the browser and keep data URIs.
export function findPreviewImgEl(
  doc: Document,
  options?: { skipDataUrls?: boolean },
): Element | undefined {
  const usable = (img: Element | null): img is Element => {
    if (!img) return false;
    const src = getDecodedAttribute(img, "src");
    return !(options?.skipDataUrls && src !== null && isDataUrl(src));
  };

  // look for an image explicitly marked as the preview image (.class .preview-image)
  const match = doc.querySelector(`img.${kPreviewImgClass}`);
  if (usable(match)) {
    return match;
  }

  const codeMatch = doc.querySelector(
    `div.${kPreviewImgClass} div.cell-output-display img`,
  );
  if (usable(codeMatch)) {
    return codeMatch;
  }

  // look for an image with name feature, cover, or thumbnail
  const imgs = doc.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i] as Element;
    const src = getDecodedAttribute(img, "src");
    if (src !== null && !isDataUrl(src) && kNamedFileRegex.test(src)) {
      return img;
    }
  }

  // as a last resort, just use the first _local_ image found within the document body
  const autoImgs = Array.from(
    doc.querySelectorAll("#quarto-document-content img"),
  );
  for (const autoImgN of autoImgs) {
    const autoImg = autoImgN as Element;
    const src = getDecodedAttribute(autoImg, "src");
    if (
      src && !src.startsWith("http:") && !src.startsWith("https:") &&
      usable(autoImg)
    ) {
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
  markdown: string,
): { wordCount: number; readingTime: number } {
  const wordCount = markdown.split(" ").length;
  return { wordCount, readingTime: Math.ceil(wordCount / kWpm) };
}
