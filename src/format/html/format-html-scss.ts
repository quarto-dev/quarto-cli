/*
* format-html-scss.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { formatResourcePath } from "../../core/resources.ts";
import {
  asBootstrapColor,
  asCssFont,
  asCssNumber,
  asCssSize,
} from "../../core/css.ts";

import { SassBundle, SassLayer } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { kTheme } from "../../config/constants.ts";

import { kBootstrapDependencyName, kCodeCopy } from "./format-html.ts";
import {
  mergeLayers,
  print,
  sassLayer,
  SassVariable,
  sassVariable,
} from "../../command/render/sass.ts";

import {
  kSite,
  kSiteSidebar,
} from "../../project/types/website/website-config.ts";

export function resolveBootstrapScss(
  input: string,
  metadata: Metadata,
): SassBundle {
  // Quarto built in css
  const quartoThemesDir = formatResourcePath(
    "html",
    join("bootstrap", "themes"),
  );

  const bootstrapDistDir = formatResourcePath(
    "html",
    join("bootstrap", "dist"),
  );

  // The core bootstrap styles
  const boostrapRules = join(
    bootstrapDistDir,
    "scss",
    "bootstrap.scss",
  );

  // Resolve the provided themes to a set of variables and styles
  const themeRaw = metadata[kTheme] || [];
  const themes = Array.isArray(themeRaw)
    ? themeRaw
    : [String(metadata[kTheme])];
  const themeLayer = resolveThemeLayer(input, themes, quartoThemesDir);

  return {
    dependency: kBootstrapDependencyName,
    key: themes.join("|"),
    user: themeLayer,
    quarto: {
      use: ["sass:color", "sass:map"],
      defaults: [
        quartoBootstrapDefaults(metadata),
      ].join("\n"),
      functions: [quartoFunctions(), quartoBootstrapFunctions()].join("\n"),
      mixins: quartoBootstrapMixins(),
      rules: [
        quartoRules(),
        quartoBootstrapRules(),
        quartoGlobalCssVariableRules(),
      ].join("\n"),
    },
    framework: {
      defaults: pandocVariablesToBootstrapDefaults(metadata).map((variable) => {
        return print(variable, false);
      }).join("\n"),
      functions: "",
      mixins: "",
      rules: Deno.readTextFileSync(boostrapRules),
    },
    loadPath: dirname(boostrapRules),
  };
}

function resolveThemeLayer(
  input: string,
  themes: string[],
  quartoThemesDir: string,
): SassLayer {
  const themeLayers: SassLayer[] = [];

  themes.forEach((theme) => {
    // The directory for this theme
    const resolvedThemePath = join(quartoThemesDir, `${theme}.scss`);

    // Read the sass layers
    if (existsSync(resolvedThemePath)) {
      // The theme appears to be a built in theme
      themeLayers.push(sassLayer(resolvedThemePath));
    } else {
      const themePath = join(dirname(input), theme);
      if (existsSync(themePath)) {
        themeLayers.push(sassLayer(themePath));
      }
    }
  });
  return mergeLayers(...themeLayers);
}

function pandocVariablesToBootstrapDefaults(
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
  // code copy selector
  add(
    explicitVars,
    "code-copy-selector",
    metadata[kCodeCopy] === undefined || metadata[kCodeCopy] === "hover"
      ? '"pre.sourceCode:hover > "'
      : '""',
  );

  // Pass through to some bootstrap variables
  add(explicitVars, "line-height-base", metadata["linestretch"], asCssNumber);
  add(explicitVars, "font-size-root", metadata["fontsize"]);
  add(explicitVars, "body-bg", metadata["backgroundcolor"]);
  add(explicitVars, "body-color", metadata["fontcolor"]);
  add(explicitVars, "link-color", metadata["linkcolor"]);
  add(explicitVars, "font-family-base", metadata["mainfont"], asCssFont);
  add(explicitVars, "font-family-code", metadata["monofont"], asCssFont);
  add(explicitVars, "mono-background-color", metadata["monobackgroundcolor"]);

  // Deal with sizes
  const explicitSizes = [
    "max-width",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
  ];
  explicitSizes.forEach((attrib) => {
    add(explicitVars, attrib, metadata[attrib], asCssSize);
  });

  return explicitVars;
}

const kCodeBorderLeft = "code-border-left";
const kCodeBlockBackground = "code-background";
const kBackground = "background";

// Quarto variables and styles
export const quartoBootstrapDefaults = (metadata: Metadata) => {
  const varFilePath = formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-variables.scss"),
  );
  const variables = [Deno.readTextFileSync(varFilePath)];

  // Forward background color
  const sidebar = (metadata[kSite] as Metadata)?.[kSiteSidebar] as Metadata;
  if (sidebar) {
    const sidebarBackground = sidebar[kBackground];
    if (sidebarBackground !== undefined) {
      variables.push(
        print(
          sassVariable(
            "sidebar-bg",
            sidebarBackground,
            typeof (sidebarBackground) === "string"
              ? asBootstrapColor
              : undefined,
          ),
        ),
      );
    }
  }

  // Forward codeleft-border
  const codeblockLeftBorder = metadata[kCodeBorderLeft];
  const codeblockBackground = metadata[kCodeBlockBackground];

  if (codeblockLeftBorder !== undefined) {
    variables.push(
      print(
        sassVariable(
          kCodeBorderLeft,
          codeblockLeftBorder,
          typeof (codeblockLeftBorder) === "string"
            ? asBootstrapColor
            : undefined,
        ),
      ),
    );

    if (codeblockBackground === undefined && codeblockLeftBorder !== false) {
      variables.push(print(sassVariable(kCodeBlockBackground, false)));
    }
  }

  // code background color
  if (codeblockBackground !== undefined) {
    variables.push(print(sassVariable(
      kCodeBlockBackground,
      codeblockBackground,
      typeof (codeblockBackground) === "string" ? asBootstrapColor : undefined,
    )));
  }

  // Any of the variables that we added from metadata should go first
  // So they provide the defaults
  return variables.reverse().join("\n");
};

export const quartoRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules.scss",
  ));

export const quartoGlobalCssVariableRules = () => {
  return `
  $font-family-monospace: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !default;
  :root {
    --quarto-font-monospace: #{inspect($font-family-monospace)};
  }
  `;
};

export const quartoBootstrapRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-rules.scss"),
  ));

export const quartoBootstrapMixins = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-mixins.scss"),
  ));

export const quartoBootstrapFunctions = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-functions.scss"),
  ));

export const quartoFunctions = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-functions.scss",
  ));
