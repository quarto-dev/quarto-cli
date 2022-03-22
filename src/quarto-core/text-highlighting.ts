/*
* text-highlighting.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { kDefaultHighlightStyle } from "../command/render/types.ts";
import { kHighlightStyle } from "../config/constants.ts";
import { FormatPandoc } from "../config/types.ts";
import { textHighlightThemePath } from "../core/resources.ts";

import { existsSync } from "fs/mod.ts";

export interface ThemeDescriptor {
  json: Record<string, unknown>;
  isAdaptive: boolean;
}

export function readHighlightingTheme(
  pandoc: FormatPandoc,
  style: "dark" | "light" | "default",
): ThemeDescriptor | undefined {
  const theme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  if (theme) {
    const themeRaw = readTheme(theme, style);
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
export function readTheme(theme: string, style: "light" | "dark" | "default") {
  const themeFile = textHighlightThemePath(
    theme,
    style === "default" ? undefined : style,
  );
  if (themeFile && existsSync(themeFile)) {
    return Deno.readTextFileSync(themeFile);
  } else {
    return undefined;
  }
}
