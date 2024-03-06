/*
 * text-highlighting.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "../deno_ral/path.ts";

import { kDefaultHighlightStyle } from "../command/render/constants.ts";
import { kHighlightStyle } from "../config/constants.ts";
import { FormatPandoc } from "../config/types.ts";

import { existsSync } from "fs/mod.ts";
import { resourcePath } from "../core/resources.ts";
import { normalizePath } from "../core/path.ts";
import { warnOnce } from "../core/log.ts";

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
  if (typeof theme === "object") {
    if (style && theme[style]) {
      resolvedTheme = theme[style] as string;
    } else {
      resolvedTheme = theme[Object.keys(theme)[0]] as string;
    }
  } else {
    resolvedTheme = theme as string;
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

  if (themePath) {
    // first see if this matches a built in name
    return themePath;
  } else {
    // see if this is a path to a user theme
    const userThemePath = join(inputDir, resolvedTheme);
    if (existsSync(userThemePath)) {
      return normalizePath(userThemePath);
    }
  }

  // Could find a path
  return undefined;
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
  if (typeof theme === "string") {
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
  if (!themeFile) {
    return undefined;
  }

  if (!existsSync(themeFile)) {
    warnOnce(`The text highlighting theme ${themeFile} does not exist.`);
    return undefined;
  }

  if (Deno.statSync(themeFile).isDirectory) {
    throw new Error(
      `The text highlighting theme ${themeFile} is a directory. Please provide a valid theme name or path to a .theme file.`,
    );
  }
  return Deno.readTextFileSync(themeFile);
}

// From  https://github.com/jgm/skylighting/blob/a1d02a0db6260c73aaf04aae2e6e18b569caacdc/skylighting-core/src/Skylighting/Format/HTML.hs#L117-L147
export const kAbbrevs: Record<string, string> = {
  "Keyword": "kw",
  "DataType": "dt",
  "DecVal": "dv",
  "BaseN": "bn",
  "Float": "fl",
  "Char": "ch",
  "String": "st",
  "Comment": "co",
  "Other": "ot",
  "Alert": "al",
  "Function": "fu",
  "RegionMarker": "re",
  "Error": "er",
  "Constant": "cn",
  "SpecialChar": "sc",
  "VerbatimString": "vs",
  "SpecialString": "ss",
  "Import": "im",
  "Documentation": "do",
  "Annotation": "an",
  "CommentVar": "cv",
  "Variable": "va",
  "ControlFlow": "cf",
  "Operator": "op",
  "BuiltIn": "bu",
  "Extension": "ex",
  "Preprocessor": "pp",
  "Attribute": "at",
  "Information": "in",
  "Warning": "wa",
  "Normal": "",
};
