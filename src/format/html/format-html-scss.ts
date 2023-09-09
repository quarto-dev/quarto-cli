/*
 * format-html-scss.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { dirname, extname, isAbsolute, join } from "path/mod.ts";

import { formatResourcePath } from "../../core/resources.ts";
import {
  asBootstrapColor,
  asCssColor,
  asCssFont,
  asCssNumber,
  asCssSize,
} from "../../core/css.ts";
import { mergeLayers, sassLayer } from "../../core/sass.ts";

import { outputVariable, SassVariable, sassVariable } from "../../core/sass.ts";

import { Format, SassBundle, SassLayer } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import { kGrid, kTheme } from "../../config/constants.ts";

import {
  kPageFooter,
  kSiteNavbar,
  kSiteSidebar,
  kWebsite,
} from "../../project/types/website/website-constants.ts";
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
  quartoCodeFilenameRules,
  quartoCopyCodeDefaults,
  quartoCopyCodeRules,
  quartoDefaults,
  quartoFunctions,
  quartoGlobalCssVariableRules,
  quartoLinkExternalRules,
  quartoRules,
  quartoUses,
  sassUtilFunctions,
} from "./format-html-shared.ts";
import { readHighlightingTheme } from "../../quarto-core/text-highlighting.ts";

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
  loadPaths?: string[],
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

  const defaults = [
    quartoDefaults(format),
    quartoBootstrapDefaults(format.metadata),
    quartoCopyCodeDefaults(),
  ].join("\n");

  return {
    dependency,
    key,
    user: sassLayer,
    quarto: {
      uses: quartoUses(),
      defaults,
      functions: [quartoFunctions(), quartoBootstrapFunctions()].join("\n"),
      mixins: quartoBootstrapMixins(),
      rules: [
        quartoRules(),
        quartoCopyCodeRules(),
        quartoBootstrapRules(),
        quartoGlobalCssVariableRules(),
        quartoLinkExternalRules(),
        quartoCodeFilenameRules(),
      ].join("\n"),
    },
    framework: {
      uses: "",
      defaults: frameworkVariables,
      functions: frameworkFunctions,
      mixins: bootstrapMixins(),
      rules: bootstrapRules(),
    },
    loadPaths: [...(loadPaths || []), bootstrapResourceDir()],
    dark: darkLayer
      ? {
        user: darkLayer,
        default: darkDefault,
      }
      : undefined,
    attribs: { id: "quarto-bootstrap" },
  };
}

export function resolveBootstrapScss(
  input: string,
  format: Format,
  sassLayers: SassLayer[],
): SassBundle[] {
  // Quarto built in css
  const quartoThemesDir = formatResourcePath(
    "html",
    join("bootstrap", "themes"),
  );

  // Resolve the provided themes to a set of variables and styles
  const theme = format.metadata[kTheme] || [];
  const [themeSassLayers, defaultDark, loadPaths] = resolveThemeLayer(
    format,
    input,
    theme,
    quartoThemesDir,
    sassLayers,
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
      loadPaths,
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
): { layers: SassLayer[]; loadPaths: string[] } {
  let injectedCustomization = false;
  const loadPaths: string[] = [];
  const layers = themes.flatMap((theme) => {
    const isAbs = isAbsolute(theme);
    const isScssFile = [".scss", ".css"].includes(extname(theme));

    if (isAbs && isScssFile) {
      // Absolute path to a SCSS file
      if (existsSync(theme)) {
        const themeDir = dirname(theme);
        loadPaths.push(themeDir);
        return sassLayer(theme);
      }
    } else if (isScssFile) {
      // Relative path to a SCSS file
      const themePath = join(dirname(input), theme);
      if (existsSync(themePath)) {
        const themeDir = dirname(themePath);
        loadPaths.push(themeDir);
        return sassLayer(themePath);
      }
    } else {
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
      }
    }
    return {
      uses: "",
      defaults: "",
      functions: "",
      mixins: "",
      rules: "",
    };
  });

  // If no themes were provided, we still should inject our customization
  if (!injectedCustomization) {
    layers.unshift(quartoBootstrapCustomizationLayer());
  }
  return { layers, loadPaths };
}

export function resolveTextHighlightingLayer(
  input: string,
  format: Format,
  style: "dark" | "light",
) {
  const layer = {
    uses: "",
    defaults: "",
    functions: "",
    mixins: "",
    rules: "",
  };

  const themeDescriptor = readHighlightingTheme(
    dirname(input),
    format.pandoc,
    style,
  );

  if (format.metadata[kCodeBlockBackground] === undefined) {
    // Inject a background color, if present
    if (themeDescriptor && !themeDescriptor.isAdaptive) {
      const backgroundColor = () => {
        if (themeDescriptor.json["background-color"]) {
          return themeDescriptor.json["background-color"] as string;
        } else {
          const editorColors = themeDescriptor.json["editor-colors"] as
            | Record<string, string>
            | undefined;
          if (editorColors && editorColors["BackgroundColor"]) {
            return editorColors["BackgroundColor"] as string;
          } else {
            return undefined;
          }
        }
      };

      const background = backgroundColor();
      if (background) {
        layer.defaults = outputVariable(
          sassVariable(
            "code-block-bg",
            asCssColor(background),
          ),
          true,
        );
      }

      const textColor = themeDescriptor.json["text-color"] as string;
      if (textColor) {
        layer.defaults = layer.defaults + "\n" + outputVariable(
          sassVariable(
            "code-block-color",
            asCssColor(textColor),
          ),
          true,
        );
      }
    }
  }

  if (themeDescriptor) {
    const readTextColor = (name: string) => {
      const textStyles = themeDescriptor.json["text-styles"];
      if (textStyles && typeof textStyles === "object") {
        const commentColor = (textStyles as Record<string, unknown>)[name];
        if (commentColor && typeof commentColor === "object") {
          const textColor =
            (commentColor as Record<string, unknown>)["text-color"];
          return textColor;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    };

    const commentColor = readTextColor("Comment");
    if (commentColor) {
      layer.defaults = layer.defaults + "\n" + outputVariable(
        sassVariable(
          "btn-code-copy-color",
          asCssColor(commentColor),
        ),
        true,
      );
    }

    const functionColor = readTextColor("Function");
    if (functionColor) {
      layer.defaults = layer.defaults + "\n" + outputVariable(
        sassVariable(
          "btn-code-copy-color-active",
          asCssColor(functionColor),
        ),
        true,
      );
    }
  }

  return layer;
}

// Resolve the themes into a ThemeSassLayer
function resolveThemeLayer(
  format: Format,
  input: string,
  themes: string | string[] | Themes | unknown,
  quartoThemesDir: string,
  sassLayers: SassLayer[],
): [ThemeSassLayer, boolean, string[]] {
  let theme = undefined;
  let defaultDark = false;

  if (typeof themes === "string") {
    // The themes is just a string
    theme = { light: [themes] };
  } else if (Array.isArray(themes)) {
    // The themes is an array
    theme = { light: themes };
  } else if (typeof themes === "object") {
    // The themes are an object  - look at each key and
    // deal with them either as a string or a string[]
    const themeArr = (theme?: unknown): string[] => {
      const themes: string[] = [];
      if (theme) {
        if (typeof theme === "string") {
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
  const lightLayerContext = layerTheme(input, theme.light, quartoThemesDir);
  lightLayerContext.layers.unshift(...sassLayers);
  const highlightingLayer = resolveTextHighlightingLayer(
    input,
    format,
    "light",
  );
  if (highlightingLayer) {
    lightLayerContext.layers.unshift(highlightingLayer);
  }

  const darkLayerContext = theme.dark
    ? layerTheme(input, theme.dark, quartoThemesDir)
    : undefined;
  if (darkLayerContext) {
    darkLayerContext.layers.push(...sassLayers);
    const darkHighlightingLayer = resolveTextHighlightingLayer(
      input,
      format,
      "dark",
    );
    if (darkHighlightingLayer) {
      darkLayerContext.layers.unshift(darkHighlightingLayer);
    }
  }

  const themeSassLayer = {
    light: mergeLayers(...lightLayerContext.layers),
    dark: darkLayerContext?.layers
      ? mergeLayers(...darkLayerContext?.layers)
      : undefined,
  };

  const loadPaths = [
    ...lightLayerContext.loadPaths,
    ...darkLayerContext?.loadPaths || [],
  ];
  return [themeSassLayer, defaultDark, loadPaths];
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
  add(explicitVars, "mono-foreground-color", metadata["monoforegroundcolor"]);

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

  // Resolve any grid variables
  const gridObj = metadata[kGrid] as Metadata;
  if (gridObj) {
    add(explicitVars, "grid-sidebar-width", gridObj["sidebar-width"]);
    add(explicitVars, "grid-margin-width", gridObj["margin-width"]);
    add(explicitVars, "grid-body-width", gridObj["body-width"]);
    add(explicitVars, "grid-column-gutter-width", gridObj["gutter-width"]);
  }
  return explicitVars;
}

function pandocVariablesToThemeScss(
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
const kTogglePosition = "toggle-position";
const kColor = "color";
const kBorder = "border";

// Quarto variables and styles
export const quartoBootstrapDefaults = (metadata: Metadata) => {
  const varFilePath = formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-variables.scss"),
  );
  const variables = [Deno.readTextFileSync(varFilePath)];
  const colorDefaults: string[] = [];

  const navbar = (metadata[kWebsite] as Metadata)?.[kSiteNavbar];
  if (navbar && typeof navbar === "object") {
    // Forward navbar background color
    const navbarBackground = (navbar as Record<string, unknown>)[kBackground];
    if (navbarBackground !== undefined) {
      resolveBootstrapColorDefault(navbarBackground, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "navbar-bg",
            navbarBackground,
            typeof navbarBackground === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward navbar foreground color
    const navbarForeground = (navbar as Record<string, unknown>)[kForeground];
    if (navbarForeground !== undefined) {
      resolveBootstrapColorDefault(navbarForeground, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "navbar-fg",
            navbarForeground,
            typeof navbarForeground === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward the toggle-position
    const navbarTogglePosition =
      (navbar as Record<string, unknown>)[kTogglePosition];
    if (navbarTogglePosition !== undefined) {
      variables.push(
        outputVariable(
          sassVariable(
            "navbar-toggle-position",
            navbarTogglePosition,
          ),
        ),
      );
    }
  }

  const sidebars = (metadata[kWebsite] as Metadata)?.[kSiteSidebar];
  const sidebar = Array.isArray(sidebars)
    ? sidebars[0]
    : typeof sidebars === "object"
    ? (sidebars as Metadata)
    : undefined;

  if (sidebar) {
    // Forward background color
    const sidebarBackground = sidebar[kBackground];
    if (sidebarBackground !== undefined) {
      resolveBootstrapColorDefault(sidebarBackground, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "sidebar-bg",
            sidebarBackground,
            typeof sidebarBackground === "string"
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
      resolveBootstrapColorDefault(sidebarForeground, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "sidebar-fg",
            sidebarForeground,
            typeof sidebarForeground === "string"
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
  if (footer !== undefined && typeof footer === "object") {
    // Forward footer color
    const footerBg = footer[kBackground];
    if (footerBg !== undefined) {
      resolveBootstrapColorDefault(footerBg, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "footer-bg",
            footerBg,
            typeof footerBg === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward footer foreground
    const footerFg = footer[kForeground];
    if (footerFg !== undefined) {
      resolveBootstrapColorDefault(footerFg, colorDefaults);
      variables.push(
        outputVariable(
          sassVariable(
            "footer-fg",
            footerFg,
            typeof footerFg === "string" ? asBootstrapColor : undefined,
          ),
        ),
      );
    }

    // Forward footer border
    const footerBorder = footer[kBorder];
    // Enable the border unless it is explicitly disabled
    const showBorder = footerBorder !== undefined
      ? footerBorder
      : sidebar?.style === "docked";
    if (showBorder) {
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
    if (footerBorder !== undefined && typeof footerBorder === "string") {
      resolveBootstrapColorDefault(footerBorder, colorDefaults);
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
    if (footerColor && typeof footerColor === "string") {
      resolveBootstrapColorDefault(footerColor, colorDefaults);
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
    resolveBootstrapColorDefault(codeblockLeftBorder, colorDefaults);
    variables.push(
      outputVariable(
        sassVariable(
          kCodeBorderLeft,
          codeblockLeftBorder,
          typeof codeblockLeftBorder === "string"
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
      typeof codeblockBackground === "string" ? asBootstrapColor : undefined,
    )));
  }

  // Ensure any color variable defaults are present
  colorDefaults.forEach((colorDefault) => {
    variables.push(colorDefault);
  });

  // Any of the variables that we added from metadata should go first
  // So they provide the defaults
  return variables.reverse().join("\n");
};

function resolveBootstrapColorDefault(value: unknown, variables: string[]) {
  if (value) {
    const variable = bootstrapColorDefault(value);
    if (
      variable &&
      !variables.find((existingVar) => {
        return existingVar === variable;
      })
    ) {
      variables.unshift(variable);
    }
  }
}

function bootstrapColorDefault(value: unknown) {
  if (typeof value === "string") {
    return bootstrapColorVars[value];
  }
}

const bootstrapColorVars: Record<string, string> = {
  primary: "$primary: #0d6efd !default;",
  secondary: "$secondary: #6c757d !default;",
  success: "$success: #198754 !default;",
  info: "$info: #0dcaf0 !default;",
  warning: "$warning: #ffc107 !default;",
  danger: "$danger: #dc3545 !default;",
  light: "$light: #f8f9fa !default;",
  dark: "$dark: #212529 !default;",
};
