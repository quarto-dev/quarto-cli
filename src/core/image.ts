/*
 * image.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/exists.ts";
import { extname } from "../deno_ral/path.ts";
import PngImage from "./png.ts";

export function imageSize(path: string) {
  if (path !== undefined) {
    if (path.endsWith(".png")) {
      if (existsSync(path)) {
        const imageData = Deno.readFileSync(path);
        try {
          const png = new PngImage(imageData);
          return {
            height: png.height,
            width: png.width,
          };
        } catch (error) {
          throw new Error(`Error reading file ${path}\n${error.message}`);
        }
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
