/*
 * format-reveal-theme.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
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
import { pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import {
  compileSass,
  mergeLayers,
  outputVariable,
  sassLayerFile,
  SassVariable,
  sassVariable,
} from "../../core/sass.ts";

import { kRevealJsUrl } from "./constants.ts";
import { resolveTextHighlightingLayer } from "../html/format-html-scss.ts";
import { quartoBaseLayer } from "../html/format-html-shared.ts";
import { TempContext } from "../../core/temp.ts";
import { hasAdaptiveTheme } from "../../quarto-core/text-highlighting.ts";
import { copyMinimal, copyTo } from "../../core/copy.ts";
import { titleSlideScss } from "./format-reveal-title.ts";
import { asCssFont, asCssNumber } from "../../core/css.ts";
import { cssHasDarkModeSentinel } from "../../core/pandoc/css.ts";

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

  // Resolve load paths
  const cssThemeDir = join(revealSrcDir, "css", "theme");
  const loadPaths = [
    join(cssThemeDir, "source"),
    join(cssThemeDir, "template"),
  ];

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
          loadPaths.unshift(join(dirname(input), dirname(theme)));
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
    uses: "",
    defaults: pandocVariablesToThemeScss(format.metadata, true),
    functions: "",
    mixins: "",
    rules: "",
  };

  // Inject the highlighting theme, if not adaptive
  const highlightingLayer = !hasAdaptiveTheme(format.pandoc)
    ? resolveTextHighlightingLayer(
      input,
      format,
      "light",
    )
    : undefined;
  const userLayers = [yamlLayer];
  if (highlightingLayer) {
    userLayers.push(highlightingLayer);
  }
  userLayers.push(...themeLayers);

  // Quarto layers
  const quartoLayers = [
    quartoBaseLayer(format, true, true, false, true),
    quartoLayer(),
  ];
  const titleSlideLayer = titleSlideScss(format);
  if (titleSlideLayer) {
    userLayers.unshift(titleSlideLayer);
  }

  // create sass bundle layers
  const bundleLayers: SassBundleLayers = {
    key: "reveal-theme",
    user: mergeLayers(...userLayers),
    quarto: mergeLayers(
      ...quartoLayers,
    ),
    framework: revealFrameworkLayer(revealSrcDir),
    loadPaths,
  };

  // compile sass
  const css = await compileSass([bundleLayers], temp);
  copyTo(
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
    uses: "",
    defaults: "",
    functions: "",
    mixins: readTemplate("mixins.scss"),
    rules: readTemplate("theme.scss"),
  };
}

export function pandocVariablesToThemeScss(
  metadata: Metadata,
  asDefaults = false,
) {
  return pandocVariablesToRevealDefaults(metadata).map(
    (variable) => {
      return outputVariable(variable, asDefaults);
    },
  ).join("\n");
}

function pandocVariablesToRevealDefaults(
  metadata: Metadata,
): SassVariable[] {
  const explicitVars: SassVariable[] = [];

  // Helper for adding explicitly set variables
  const add = (
    defaults: SassVariable[],
    name: string,
    value?: unknown,
    formatter?: (val: unknown) => unknown,
  ) => {
    if (value) {
      const sassVar = sassVariable(name, value, formatter);
      defaults.push(sassVar);
    }
  };

  // Pass through to some theme variables variables
  add(explicitVars, "font-family-sans-serif", metadata["mainfont"], asCssFont);
  add(explicitVars, "font-family-monospace", metadata["monofont"], asCssFont);
  add(explicitVars, "presentation-font-size-root", metadata["fontsize"]);
  add(
    explicitVars,
    "presentation-line-height",
    metadata["linestretch"],
    asCssNumber,
  );
  add(explicitVars, "code-block-bg", metadata["monobackgroundcolor"]);
  return explicitVars;
}

function quartoLayer(): SassLayer {
  return sassLayerFile(formatResourcePath("revealjs", "quarto.scss"));
}

function themeLayer(theme: string): SassLayer {
  return sassLayerFile(theme);
}
