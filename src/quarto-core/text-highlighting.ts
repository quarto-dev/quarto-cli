/*
* text-highlighting.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "path/mod.ts";

import { kDefaultHighlightStyle } from "../command/render/constants.ts";
import { kHighlightStyle } from "../config/constants.ts";
import { FormatPandoc } from "../config/types.ts";

import { existsSync } from "fs/mod.ts";
import { resourcePath } from "../core/resources.ts";
import { normalizePath } from "../core/path.ts";

export interface ThemeDescriptor {
  json: Record<string, unknown>;
  isAdaptive: boolean;
}

const kDarkSuffix = "dark";
const kLightSuffix = "light";

export function textHighlightThemePath(
  inputDir: string,
  theme: string | Record<string, string>,
  style?: "dark" | "light",
) {
  let resolvedTheme: string;
  if (typeof (theme) === "object") {
    if (style && theme[style]) {
      resolvedTheme = theme[style] as string;
    } else {
      resolvedTheme = theme[Object.keys(theme)[0]] as string;
    }
  } else {
    resolvedTheme = theme as string;
  }

  const userThemePath = join(inputDir, resolvedTheme);
  if (existsSync(userThemePath)) {
    return normalizePath(userThemePath);
  }

  // First try the style specific version of the theme, otherwise
  // fall back to the plain name
  const names = [
    `${theme}-${style === "dark" ? kDarkSuffix : kLightSuffix}`,
    theme,
  ];

  const themePath = names.map((name) => {
    return resourcePath(join("pandoc", "highlight-styles", `${name}.theme`));
  }).find((path) => existsSync(path));
  return themePath;
}

export function readHighlightingTheme(
  inputDir: string,
  pandoc: FormatPandoc,
  style: "dark" | "light" | "default",
): ThemeDescriptor | undefined {
  const theme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  if (theme) {
    const themeRaw = readTheme(inputDir, theme, style);
    if (themeRaw) {
      return {
        json: JSON.parse(themeRaw),
        isAdaptive: isAdaptiveTheme(theme),
      };
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

export function hasAdaptiveTheme(pandoc: FormatPandoc) {
  const theme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  return theme && isAdaptiveTheme(theme);
}

export function hasTextHighlighting(pandoc: FormatPandoc): boolean {
  const theme = pandoc[kHighlightStyle];
  return theme !== null;
}

export function isAdaptiveTheme(theme: string | Record<string, string>) {
  if (typeof (theme) === "string") {
    return [
      "a11y",
      "arrow",
      "atom-one",
      "ayu",
      "breeze",
      "github",
      "gruvbox",
      "monochrome",
    ].includes(
      theme,
    );
  } else {
    const keys = Object.keys(theme);
    return keys.includes("dark") && keys.includes("light");
  }
}

// Reads the contents of a theme file, falling back if the style specific version isn't available
export function readTheme(
  inputDir: string,
  theme: string | Record<string, string>,
  style: "light" | "dark" | "default",
) {
  const themeFile = textHighlightThemePath(
    inputDir,
    theme,
    style === "default" ? undefined : style,
  );
  if (themeFile && existsSync(themeFile)) {
    return Deno.readTextFileSync(themeFile);
  } else {
    return undefined;
  }
}
