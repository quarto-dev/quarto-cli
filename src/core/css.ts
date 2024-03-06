/*
 * css.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { dirname, extname, join } from "../deno_ral/path.ts";
import { isFileRef } from "./http.ts";
import { normalizePath } from "./path.ts";

export const kCssUrlRegex =
  /url\((?!['"]?(?:data|https?):)(['"])?([^'"]*?)\1\)/g;
export const kCssImportRegex =
  /@import\s(?!['"](?:data|https?):)(['"])([^'"]*?)\1/g;

export function cssFileResourceReferences(files: string[]) {
  return files.reduce((allRefs: string[], file: string) => {
    if (extname(file).toLowerCase() === ".css") {
      if (existsSync(file)) {
        file = normalizePath(file);
        const css = Deno.readTextFileSync(file);
        const cssRefs = cssFileRefs(css).map((ref) => join(dirname(file), ref));
        allRefs.push(...cssRefs);
        allRefs.push(...cssFileResourceReferences(cssRefs));
      }
    }
    return allRefs;
  }, []);
}

export function isCssFile(path: string) {
  return extname(path).toLowerCase() === ".css";
}

export function fixupCssReferences(
  css: string,
  resolveRef: (ref: string) => string,
) {
  // fixup / copy refs from url()
  let destCss = css.replaceAll(
    kCssUrlRegex,
    (_match, p1: string, p2: string) => {
      const path = resolveRef(p2);
      return `url(${p1 || ""}${path}${p1 || ""})`;
    },
  );

  // fixup / copy refs from @import
  destCss = destCss.replaceAll(
    kCssImportRegex,
    (_match, p1: string, p2: string) => {
      const path = resolveRef(p2);
      return `@import ${p1 || ""}${path}${p1 || ""}`;
    },
  );

  return destCss;
}

export function cssFileRefs(css: string) {
  return cssImports(css).concat(cssResources(css)).filter(isFileRef);
}

export function cssResources(css: string) {
  return matchCss(css, kCssUrlRegex);
}

export function cssImports(css: string) {
  return matchCss(css, kCssImportRegex);
}

function matchCss(css: string, regex: RegExp): string[] {
  const matches = [];
  regex.lastIndex = 0;
  let match = regex.exec(css);
  while (match != null) {
    matches.push(match[2]);
    match = regex.exec(css);
  }
  regex.lastIndex = 0;
  return matches;
}

export function asCssFont(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  } else {
    const fontFamily = String(value)
      .split(",")
      .map((font) => {
        font = font.trim();
        if (font.includes(" ")) {
          font = `"${font}"`;
        }
        return font;
      })
      .filter((font) => font.length > 0)
      .join(", ");
    return `${fontFamily}`;
  }
}

export function asCssNumber(value: unknown): string | undefined {
  if (typeof value === "number") {
    return String(value);
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    const match = str.match(/(^[0-9]*)/);
    if (match) {
      return match[1];
    } else {
      return undefined;
    }
  }
}

export function asCssSize(value: unknown): string | undefined {
  if (typeof value === "number") {
    if (value === 0) {
      return "0";
    } else {
      return value + "px";
    }
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    if (str !== "0" && !str.match(/[^0-9]$/)) {
      return str + "px";
    } else {
      return str;
    }
  }
}

export function asCssColor(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (value === "none") {
      return "transparent";
    } else {
      return value;
    }
  }
}

// The named colors
const kBootstrapColors = [
  "primary",
  "secondary",
  "success",
  "info",
  "warning",
  "danger",
  "light",
  "dark",
];

const kBootstrapPaletteRegex = RegExp(
  `gray\-[1-9]00`,
);

export function asBootstrapColor(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (
      kBootstrapColors.includes(value) || value.match(kBootstrapPaletteRegex)
    ) {
      return `$${value}`;
    } else {
      return asCssColor(value);
    }
  }
}
