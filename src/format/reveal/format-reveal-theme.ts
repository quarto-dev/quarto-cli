/*
* format-reveal-theme.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { kTheme } from "../../config/constants.ts";
import { Format, kTextHighlightingMode, Metadata } from "../../config/types.ts";

import { isFileRef } from "../../core/http.ts";
import { copyMinimal, pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { compileWithCache } from "../../core/sass.ts";

import { kRevealJsUrl } from "./format-reveal.ts";

export const kRevealLightThemes = [
  "white",
  "beige",
  "sky",
  "serif",
  "simple",
  "solarized",
];

export const kRevealDarkThemes = [
  "black",
  "league",
  "night",
  "blood",
  "moon",
];

export const kRevealThemes = [...kRevealLightThemes, ...kRevealDarkThemes];

export async function revealTheme(format: Format, libDir: string) {
  // metadata override to return
  const metadata: Metadata = {};

  // if there is no revealjs-url provided then use our embedded copy
  const revealJsUrl = format.metadata[kRevealJsUrl] as string | undefined;
  if ((revealJsUrl === undefined) || isFileRef(revealJsUrl)) {
    // copy reveal dir
    const revealSrcDir = revealJsUrl ||
      formatResourcePath("revealjs", "reveal");
    const revealDir = join(libDir, "revealjs");
    copyMinimal(revealSrcDir, revealDir);
    metadata[kRevealJsUrl] = pathWithForwardSlashes(
      revealDir,
    );

    // theme could be a reveal theme name or an sccs file
    // (if no theme is specified then use our built in theme)
    const theme = (format.metadata![kTheme] ||
      formatResourcePath("revealjs", "theme.scss")) as string;
    if (!kRevealThemes.includes(theme)) {
      const cssThemeDir = join(revealDir, "css", "theme");
      const cssSourceDir = join(cssThemeDir, "source");
      const cssTemplateDir = join(cssThemeDir, "template");
      const themeScss = Deno.readTextFileSync(
        existsSync(theme) ? theme : join(cssSourceDir, theme + ".scss"),
      );
      const scss = await compileWithCache(themeScss, [
        cssSourceDir,
        cssTemplateDir,
      ]);
      Deno.copyFileSync(
        scss,
        join(revealDir, "dist", "theme", "quarto.css"),
      );
      metadata[kTheme] = "quarto";
    }
  }

  // determine light vs. dark highlighting mode
  const dark = format.metadata[kTheme] &&
    kRevealDarkThemes.includes(format.metadata[kTheme] as string);
  const highlightingMode: "light" | "dark" = dark ? "dark" : "light";

  // return
  return {
    metadata,
    [kTextHighlightingMode]: highlightingMode,
  };
}
