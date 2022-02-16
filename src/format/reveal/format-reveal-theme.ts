/*
* format-reveal-theme.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { kTheme } from "../../config/constants.ts";
import {
  Format,
  kTextHighlightingMode,
  Metadata,
  SassBundleLayers,
  SassLayer,
} from "../../config/types.ts";

import { isFileRef } from "../../core/http.ts";
import { copyMinimal, pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { compileSass, mergeLayers, sassLayerFile } from "../../core/sass.ts";

import { kRevealJsUrl } from "./format-reveal.ts";
import { cssHasDarkModeSentinel } from "../../command/render/pandoc-html.ts";
import { pandocVariablesToThemeScss } from "../html/format-html-scss.ts";
import { quartoBaseLayer } from "../html/format-html-shared.ts";
import { TempContext } from "../../core/temp.ts";

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

export async function revealTheme(
  format: Format,
  input: string,
  libDir: string,
  temp: TempContext,
) {
  // metadata override to return
  const metadata: Metadata = {};

  // target revealDir
  const revealDir = join(libDir, "revealjs");

  // revealurl (optional)
  const revealJsUrl = format.metadata[kRevealJsUrl] as string | undefined;

  // we don't support remote versions b/c we need to compile the scss
  if (revealJsUrl && !isFileRef(revealJsUrl)) {
    throw new Error(
      "Invalid revealjs-url: " + revealJsUrl +
        " (remote urls are not supported)",
    );
  }

  // compute reveal url
  const revealUrl = pathWithForwardSlashes(revealDir);
  metadata[kRevealJsUrl] = revealUrl;

  // copy reveal dir
  const revealSrcDir = revealJsUrl ||
    formatResourcePath("revealjs", "reveal");
  const revealDestDir = join(dirname(input), libDir, "revealjs");
  ["dist", "plugin"].forEach((dir) => {
    copyMinimal(join(revealSrcDir, dir), join(revealDestDir, dir));
  });

  // theme is either user provided scss or something in our 'themes' dir
  // (note that standard reveal scss themes must be converted to quarto
  // theme format so they can participate in the pipeline)
  const themeConfig =
    (format.metadata?.[kTheme] as string | string[] | undefined) || "default";
  const themeLayers = (Array.isArray(themeConfig) ? themeConfig : [themeConfig])
    .map(
      (theme) => {
        const themePath = join(relative(Deno.cwd(), dirname(input)), theme);
        if (existsSync(themePath)) {
          return themeLayer(themePath);
        } else {
          // alias revealjs theme names
          if (theme === "white") {
            theme = "default";
          } else if (theme === "black") {
            theme = "dark";
          }
          // read theme
          theme = formatResourcePath(
            "revealjs",
            join("themes", `${theme}.scss`),
          );
          return themeLayer(theme);
        }
      },
    );

  // get any variables defined in yaml
  const yamlLayer: SassLayer = {
    defaults: pandocVariablesToThemeScss(format.metadata, true),
    functions: "",
    mixins: "",
    rules: "",
  };

  const cssThemeDir = join(revealSrcDir, "css", "theme");
  const loadPaths = [
    join(cssThemeDir, "source"),
    join(cssThemeDir, "template"),
  ];

  // create sass bundle layers
  const bundleLayers: SassBundleLayers = {
    key: "reveal-theme",
    user: mergeLayers(yamlLayer, ...themeLayers),
    quarto: mergeLayers(
      quartoBaseLayer(format, true, true, false, true),
      quartoLayer(),
    ),
    framework: revealFrameworkLayer(revealSrcDir),
    loadPaths,
  };

  // compile sass
  const css = await compileSass([bundleLayers], temp);
  Deno.copyFileSync(
    css,
    join(revealDestDir, "dist", "theme", "quarto.css"),
  );
  metadata[kTheme] = "quarto";

  const highlightingMode: "light" | "dark" =
    cssHasDarkModeSentinel(Deno.readTextFileSync(css)) ? "dark" : "light";

  // return
  return {
    revealUrl,
    revealDestDir,
    metadata,
    [kTextHighlightingMode]: highlightingMode,
  };
}

function revealFrameworkLayer(revealDir: string): SassLayer {
  const readTemplate = (template: string) => {
    return Deno.readTextFileSync(
      join(revealDir, "css", "theme", "template", template),
    );
  };
  return {
    defaults: "",
    functions: "",
    mixins: readTemplate("mixins.scss"),
    rules: readTemplate("theme.scss"),
  };
}

function quartoLayer(): SassLayer {
  const layer = sassLayerFile(formatResourcePath("revealjs", "quarto.scss"));
  layer.use = ["sass:color", "sass:map", "sass:math"];
  return layer;
}

function themeLayer(theme: string): SassLayer {
  return sassLayerFile(theme);
}
