/*
 * image.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "../deno_ral/fs.ts";
import { extname } from "../deno_ral/path.ts";
import PngImage, { isPng } from "./png.ts";
import { isJpeg, jpegSize } from "./jpeg.ts";

// Pixel size of a PNG or JPEG file, detected from its header bytes rather
// than its extension. Other formats have no size.
export function imageSize(path: string) {
  if (path !== undefined) {
    if (existsSync(path, { isFile: true })) {
      const imageData = Deno.readFileSync(path);
      try {
        if (isPng(imageData)) {
          const png = new PngImage(imageData);
          return {
            height: png.height,
            width: png.width,
          };
        } else if (isJpeg(imageData)) {
          return jpegSize(imageData);
        }
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        throw new Error(`Error reading file ${path}\n${error.message}`);
      }
    }
  }
}

export function imageContentType(path: string) {
  const ext = extname(path);
  return kimageTypes[ext];
}

// From
// https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
const kimageTypes: Record<string, string> = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".pjpeg": "image/jpeg",
  ".pjp": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
