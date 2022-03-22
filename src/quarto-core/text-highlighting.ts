/*
* text-highlighting.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { kDefaultHighlightStyle } from "../command/render/types.ts";
import { kHighlightStyle } from "../config/constants.ts";
import { FormatPandoc } from "../config/types.ts";

import { existsSync } from "fs/mod.ts";
import { resourcePath } from "../core/resources.ts";

export interface ThemeDescriptor {
  json: Record<string, unknown>;
  isAdaptive: boolean;
}

const kDarkSuffix = "dark";
const kLightSuffix = "light";

export function textHighlightThemePath(
  inputDir: string,
  theme: string,
  style?: "dark" | "light",
) {
  const userThemePath = join(inputDir, theme);
  if (existsSync(userThemePath)) {
    return Deno.realPathSync(userThemePath);
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

export function isAdaptiveTheme(name: string) {
  return [
    "arrow",
    "atom-one",
    "ayu",
    "breeze",
    "github",
    "gruvbox",
    "monochrome",
  ].includes(
    name,
  );
}

// Reads the contents of a theme file, falling back if the style specific version isn't available
export function readTheme(
  inputDir: string,
  theme: string,
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
