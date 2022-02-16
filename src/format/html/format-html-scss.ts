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
import { mergeLayers, sassLayer } from "../../core/sass.ts";

import { outputVariable, SassVariable, sassVariable } from "../../core/sass.ts";

import { Format, SassBundle, SassLayer } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import { kTheme } from "../../config/constants.ts";

import {
  kPageFooter,
  kSiteNavbar,
  kSiteSidebar,
  kWebsite,
} from "../../project/types/website/website-config.ts";
import {
  bootstrapFunctions,
  bootstrapMixins,
  bootstrapResourceDir,
  bootstrapRules,
  bootstrapVariables,
  kBootstrapDependencyName,
  quartoBootstrapCustomizationLayer,
  quartoBootstrapFunctions,
  quartoBootstrapMixins,
  quartoBootstrapRules,
  quartoCodeExampleLinkRules,
  quartoCopyCodeRules,
  quartoDefaults,
  quartoFunctions,
  quartoGlobalCssVariableRules,
  quartoLinkExternalRules,
  quartoRules,
  sassUtilFunctions,
} from "./format-html-shared.ts";

export interface Themes {
  light: string[];
  dark?: string[];
}

function layerQuartoScss(
  key: string,
  dependency: string,
  sassLayer: SassLayer,
  format: Format,
  darkLayer?: SassLayer,
  darkDefault?: boolean,
): SassBundle {
  // The bootstrap framework functions
  const frameworkFunctions = [
    bootstrapFunctions(),
    sassUtilFunctions("color-contrast.scss"),
  ].join(
    "\n",
  );

  // The bootstrap framework variables
  const frameworkVariables = [
    bootstrapVariables(),
    pandocVariablesToThemeScss(format.metadata),
  ].join("\n");

  return {
    dependency,
    key,
    user: sassLayer,
    quarto: {
      use: ["sass:color", "sass:map", "sass:math"],
      defaults: [
        quartoDefaults(format),
        quartoBootstrapDefaults(format.metadata),
      ].join("\n"),
      functions: [quartoFunctions(), quartoBootstrapFunctions()].join("\n"),
      mixins: quartoBootstrapMixins(),
      rules: [
        quartoRules(),
        quartoCopyCodeRules(),
        quartoCodeExampleLinkRules(),
        quartoBootstrapRules(),
        quartoGlobalCssVariableRules(),
        quartoLinkExternalRules(),
      ].join("\n"),
    },
    framework: {
      defaults: frameworkVariables,
      functions: frameworkFunctions,
      mixins: bootstrapMixins(),
      rules: bootstrapRules(),
    },
    loadPaths: [bootstrapResourceDir()],
    dark: darkLayer
      ? {
        user: darkLayer,
        default: darkDefault,
      }
      : undefined,
  };
}

export function resolveBootstrapScss(
  input: string,
  format: Format,
): SassBundle[] {
  // Quarto built in css
  const quartoThemesDir = formatResourcePath(
    "html",
    join("bootstrap", "themes"),
  );

  // Resolve the provided themes to a set of variables and styles
  const theme = format.metadata[kTheme] || [];
  const [themeSassLayers, defaultDark] = resolveThemeLayer(
    input,
    theme,
    quartoThemesDir,
  );

  // Find light and dark sass layers
  const sassBundles: SassBundle[] = [];

  // light
  sassBundles.push(
    layerQuartoScss(
      "quarto-theme",
      kBootstrapDependencyName,
      themeSassLayers.light,
      format,
      themeSassLayers.dark,
      defaultDark,
    ),
  );

  return sassBundles;
}

export interface ThemeSassLayer {
  light: SassLayer;
  dark?: SassLayer;
}

function layerTheme(
  input: string,
  themes: string[],
  quartoThemesDir: string,
): SassLayer[] {
  let injectedCustomization = false;
  const layers = themes.flatMap((theme) => {
    // The directory for this theme
    const resolvedThemePath = join(quartoThemesDir, `${theme}.scss`);
    // Read the sass layers
    if (existsSync(resolvedThemePath)) {
      // The theme appears to be a built in theme

      // The theme layer from a built in theme
      const themeLayer = sassLayer(resolvedThemePath);

      // Inject customization of the theme (this should go just after the theme)
      injectedCustomization = true;
      return [themeLayer, quartoBootstrapCustomizationLayer()];
    } else {
      const themePath = join(dirname(input), theme);
      if (existsSync(themePath)) {
        return sassLayer(themePath);
      } else {
        return {
          defaults: "",
          functions: "",
          mixins: "",
          rules: "",
        };
      }
    }
  });

  // If no themes were provided, we still should inject our customization
  if (!injectedCustomization) {
    layers.unshift(quartoBootstrapCustomizationLayer());
  }
  return layers;
}

// Resolve the themes into a ThemeSassLayer
function resolveThemeLayer(
  input: string,
  themes: string | string[] | Themes | unknown,
  quartoThemesDir: string,
): [ThemeSassLayer, boolean] {
  let theme = undefined;
  let defaultDark = false;
  if (typeof (themes) === "string") {
    // The themes is just a string
    theme = { light: [themes] };
  } else if (Array.isArray(themes)) {
    // The themes is an array
    theme = { light: themes };
  } else if (typeof (themes) === "object") {
    // The themes are an object  - look at each key and
    // deal with them either as a string or a string[]
    const themeArr = (theme?: unknown): string[] => {
      const themes: string[] = [];
      if (theme) {
        if (typeof (theme) === "string") {
          themes.push(theme);
        } else if (Array.isArray(theme)) {
          themes.push(...theme);
        }
      }
      return themes;
    };

    const themeObj = themes as Record<string, unknown>;

    // See whether the dark or light theme is the default
    const keyList = Object.keys(themeObj);
    defaultDark = keyList.length > 1 && keyList[0] === "dark";

    theme = {
      light: themeArr(themeObj.light),
      dark: themeObj.dark ? themeArr(themeObj.dark) : undefined,
    };
  } else {
    theme = { light: [] };
  }
  const themeSassLayer = {
    light: mergeLayers(...layerTheme(input, theme.light, quartoThemesDir)),
    dark: theme.dark
      ? mergeLayers(...layerTheme(input, theme.dark, quartoThemesDir))
      : undefined,
  };
  return [themeSassLayer, defaultDark];
}

function pandocVariablesToThemeDefaults(
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

export function pandocVariablesToThemeScss(
  metadata: Metadata,
  asDefaults = false,
) {
  return pandocVariablesToThemeDefaults(metadata).map(
    (variable) => {
      return outputVariable(variable, asDefaults);
    },
  ).join("\n");
}

const kCodeBorderLeft = "code-block-border-left";
const kCodeBlockBackground = "code-block-bg";
const kBackground = "background";
const kForeground = "foreground";
const kColor = "color";
const kBorder = "border";

// Quarto variables and styles
export const quartoBootstrapDefaults = (metadata: Metadata) => {
  const varFilePath = formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-variables.scss"),
  );
  const variables = [Deno.readTextFileSync(varFilePath)];

  const navbar = (metadata[kWebsite] as Metadata)?.[kSiteNavbar];
  if (navbar && typeof (navbar) === "object") {
    // Forward navbar background color
    const navbarBackground = (navbar as Record<string, unknown>)[kBackground];
    if (navbarBackground !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "navbar-bg",
            navbarBackground,
            typeof (navbarBackground) === "string"
              ? asBootstrapColor
              : undefined,
          ),
        ),
      );
    }

    // Forward navbar foreground color
    const navbarForeground = (navbar as Record<string, unknown>)[kForeground];
    if (navbarForeground !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "navbar-fg",
            navbarForeground,
            typeof (navbarForeground) === "string"
              ? asBootstrapColor
              : undefined,
          ),
        ),
      );
    }
  }

  const sidebars = (metadata[kWebsite] as Metadata)?.[kSiteSidebar];
  const sidebar = Array.isArray(sidebars)
    ? sidebars[0]
    : typeof (sidebars) === "object"
    ? (sidebars as Metadata)
    : undefined;

  if (sidebar) {
    // Forward background color
    const sidebarBackground = sidebar[kBackground];
    if (sidebarBackground !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "sidebar-bg",
            sidebarBackground,
            typeof (sidebarBackground) === "string"
              ? asBootstrapColor
              : undefined,
          ),
        ),
      );
    } else if (sidebar.style === "floating" || navbar) {
      // If this is a floating sidebar or there is a navbar present,
      // default to a body colored sidebar
      variables.push(
        `$sidebar-bg: if(variable-exists(body-bg), $body-bg, #fff) !default;`,
      );
    }

    // Forward foreground color
    const sidebarForeground = sidebar[kForeground];
    if (sidebarForeground !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "sidebar-fg",
            sidebarForeground,
            typeof (sidebarForeground) === "string"
              ? asBootstrapColor
              : undefined,
          ),
        ),
      );
    }

    // Enable the sidebar border for docked by default
    const sidebarBorder = sidebar[kBorder];
    variables.push(
      outputVariable(
        sassVariable(
          "sidebar-border",
          sidebarBorder !== undefined
            ? sidebarBorder
            : sidebar.style === "docked",
        ),
      ),
    );
  } else {
    // If there is no sidebar, default to body color for any sidebar that may appear
    variables.push(
      `$sidebar-bg: if(variable-exists(body-bg), $body-bg, #fff) !default;`,
    );
  }

  const footer = (metadata[kWebsite] as Metadata)?.[kPageFooter] as Metadata;
  if (footer !== undefined && typeof (footer) === "object") {
    // Forward footer color
    const footerBg = footer[kBackground];
    if (footerBg !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "footer-bg",
            footerBg,
            typeof (footerBg) === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward footer foreground
    const footerFg = footer[kForeground];
    if (footerFg !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "footer-fg",
            footerFg,
            typeof (footerFg) === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward footer border
    const footerBorder = footer[kBorder];
    // Enable the border unless it is explicitly disabled
    if (footerBorder !== false) {
      variables.push(
        outputVariable(
          sassVariable(
            "footer-border",
            true,
          ),
        ),
      );
    }

    // If the footer border is a color, set that
    if (footerBorder !== undefined && typeof (footerBorder) === "string") {
      variables.push(
        outputVariable(
          sassVariable(
            "footer-border-color",
            footerBorder,
            asBootstrapColor,
          ),
        ),
      );
    }

    // Forward any footer color
    const footerColor = footer[kColor];
    if (footerColor && typeof (footerColor) === "string") {
      variables.push(
        outputVariable(
          sassVariable(
            "footer-color",
            footerColor,
            asBootstrapColor,
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
      outputVariable(
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
      variables.push(outputVariable(sassVariable(kCodeBlockBackground, false)));
    }
  }

  // code background color
  if (codeblockBackground !== undefined) {
    variables.push(outputVariable(sassVariable(
      kCodeBlockBackground,
      codeblockBackground,
      typeof (codeblockBackground) === "string" ? asBootstrapColor : undefined,
    )));
  }

  // Any of the variables that we added from metadata should go first
  // So they provide the defaults
  return variables.reverse().join("\n");
};
