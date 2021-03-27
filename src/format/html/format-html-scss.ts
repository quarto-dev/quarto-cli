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
  asCssColor,
  asCssFont,
  asCssNumber,
  asCssSize,
} from "../../core/css.ts";

import { SassBundle, SassLayer } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { kTheme } from "../../config/constants.ts";

import { kBootstrapDependencyName, kCodeCopy } from "./format-html.ts";
import {
  print,
  SassVariable,
  sassVariable,
} from "../../command/render/sass.ts";

const kThemeScopeRegex =
  /^\/\/[ \t]*theme:(variables|rules|declarations)[ \t]*$/;

export function resolveBootstrapScss(metadata: Metadata): SassBundle {
  // Quarto built in css
  const quartoThemesDir = formatResourcePath("html", `bootstrap/themes`);

  // The core bootstrap styles
  const boostrapRules = join(
    quartoThemesDir,
    "default/scss/bootstrap.scss",
  );

  // Resolve the provided themes to a set of variables and styles
  const themeRaw = metadata[kTheme] || [];
  const themes = Array.isArray(themeRaw)
    ? themeRaw
    : [String(metadata[kTheme])];
  const themeLayer = resolveThemeLayer(themes, quartoThemesDir);

  return {
    dependency: kBootstrapDependencyName,
    key: themes.join("|"),
    user: themeLayer,
    quarto: {
      use: ["sass:color", "sass:map"],
      variables: quartoBootstrapVariables(metadata),
      declarations: quartoDeclarations(),
      rules: [
        quartoRules(),
        quartoBootstrapRules(),
      ].join("\n"),
    },
    framework: {
      variables: mapBootstrapPandocVariables(metadata).map((variable) => {
        return print(variable, false);
      }).join("\n"),
      declarations: "",
      rules: Deno.readTextFileSync(boostrapRules),
    },
    loadPath: dirname(boostrapRules),
  };
}

function resolveThemeLayer(
  themes: string[],
  quartoThemesDir: string,
): SassLayer {
  const themeLayers: Array<
    { variables?: string; rules?: string; declarations?: string }
  > = [];

  themes.forEach((theme) => {
    const resolvedThemeDir = join(quartoThemesDir, theme);
    const read = (
      path: string,
    ) => {
      if (existsSync(path)) {
        return Deno.readTextFileSync(path);
      } else {
        return undefined;
      }
    };

    if (existsSync(resolvedThemeDir)) {
      // It's a built in theme, just read and return the data
      themeLayers.push({
        variables: read(join(resolvedThemeDir, "_variables.scss")),
        rules: read(join(resolvedThemeDir, "_bootswatch.scss")),
      });
    } else if (existsSync(theme)) {
      if (Deno.statSync(theme).isFile) {
        // It is not a built in theme, so read the theme file and parse it.
        const rawContents = Deno.readTextFileSync(theme);
        const lines = rawContents.split("\n");

        const vars: string[] = [];
        const rules: string[] = [];
        const declarations: string[] = [];
        let accum = vars;
        lines.forEach((line) => {
          const scopeMatch = line.match(kThemeScopeRegex);
          if (scopeMatch) {
            const scope = scopeMatch[1];
            switch (scope) {
              case "variables":
                accum = vars;
                break;
              case "rules":
                accum = rules;
                break;
              case "declarations":
                accum = declarations;
                break;
            }
          } else {
            accum.push(line);
          }
        });

        themeLayers.push({
          variables: vars.join("\n"),
          rules: rules.join("\n"),
          declarations: declarations.join("\n"),
        });
      } else {
        // It's a directory, look for names files instead
        themeLayers.push({
          variables: read(join(theme, "_variables.scss")),
          rules: read(join(theme, "_rules.scss")),
          declarations: read(join(theme, "_declarations.scss")),
        });
      }
    }
  });

  const themeVariables: string[] = [];
  const themeRules: string[] = [];
  const themeDeclarations: string[] = [];
  themeLayers.forEach((theme) => {
    if (theme.variables) {
      themeVariables.push(theme.variables);
    }

    if (theme.rules) {
      themeRules.push(theme.rules);
    }

    if (theme.declarations) {
      themeDeclarations.push(theme.declarations);
    }
  });

  return {
    variables: themeVariables.join("\n"),
    declarations: themeDeclarations.join("\n"),
    rules: themeRules.join("\n"),
  };
}

function mapBootstrapPandocVariables(metadata: Metadata): SassVariable[] {
  const explicitVars: SassVariable[] = [];

  // Helper for adding explicitly set variables
  const add = (
    variables: SassVariable[],
    name: string,
    value?: unknown,
    formatter?: (val: unknown) => unknown,
  ) => {
    if (value) {
      const sassVar = sassVariable(name, value, formatter);
      variables.push(sassVar);
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
  add(explicitVars, "font-size-root", metadata["font-size"]);
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

// Quarto variables and styles
export const quartoBootstrapVariables = (metadata: Metadata) => {
  const varFilePath = formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-variables.scss"),
  );
  const variables = [Deno.readTextFileSync(varFilePath)];

  // Forward codeleft-border
  const codeblockLeftBorder = metadata[kCodeBorderLeft];
  if (codeblockLeftBorder !== undefined) {
    variables.push(
      print(
        sassVariable(
          kCodeBorderLeft,
          codeblockLeftBorder,
          typeof (codeblockLeftBorder) === "string" ? asCssColor : undefined,
        ),
      ),
    );
  }

  // code background color
  const codeblockBackground = metadata[kCodeBlockBackground];
  if (codeblockBackground !== undefined) {
    variables.push(print(sassVariable(
      kCodeBlockBackground,
      codeblockBackground,
      typeof (codeblockBackground) === "string" ? asCssColor : undefined,
    )));

    if (codeblockLeftBorder === undefined) {
      variables.push(print(sassVariable(kCodeBorderLeft, false)));
    }
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

export const quartoBootstrapRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-rules.scss"),
  ));

export const quartoDeclarations = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-declarations.scss",
  ));
