/*
* discover-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { getDecodedAttribute } from "../../../../core/html.ts";
import { lines } from "../../../../core/text.ts";

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

export function findDescriptionMd(markdown?: string): string | undefined {
  if (markdown) {
    const previewText: string[] = [];
    let accum = false;

    // Controls what counts as ignorable lines (empty or markdown of
    // specific types)
    const skipLines = [/^\#+/, /^\:\:\:[\:]*/];
    const emptyLine = (line: string) => {
      return line.trim() === "";
    };

    // Go through each line and find the first paragraph, then accumulate
    // that text as the description
    for (const line of lines(markdown)) {
      if (!accum) {
        // When we encounter the first
        if (!emptyLine(line) && !skipLines.find((skip) => line.match(skip))) {
          accum = true;
          previewText.push(line);
        }
      } else {
        if (emptyLine(line) || skipLines.find((skip) => line.match(skip))) {
          break;
        } else {
          previewText.push(line);
        }
      }
    }
    return previewText.join("\n");
  }
  return undefined;
}
