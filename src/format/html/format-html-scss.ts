/*
* format-html-scss.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { formatResourcePath } from "../../core/resources.ts";
import { asCssFont, asCssNumber, asCssSize } from "../../core/css.ts";

import { SassBundle } from "../../config/format.ts";
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
  const themeScss = resolveThemeScss(themes, quartoThemesDir);

  const themeVariables: string[] = [];
  const themeRules: string[] = [];
  const themeDeclarations: string[] = [];
  themeScss.forEach((theme) => {
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
    dependency: kBootstrapDependencyName,
    key: themes.join("|"),
    user: {
      variables: themeVariables.join("\n"),
      declarations: themeDeclarations.join("\n"),
      rules: themeRules.join("\n"),
    },
    quarto: {
      use: ["sass:color", "sass:map"],
      variables: Deno.readTextFileSync(quartoBootstrapVariables()),
      declarations: Deno.readTextFileSync(quartoDeclarations()),
      rules: [
        Deno.readTextFileSync(quartoRules()),
        Deno.readTextFileSync(quartoBootstrapRules()),
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

function resolveThemeScss(
  themes: string[],
  quartoThemesDir: string,
): Array<{ variables?: string; rules?: string; declarations?: string }> {
  const themeScss: Array<
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
      themeScss.push({
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

        themeScss.push({
          variables: vars.join("\n"),
          rules: rules.join("\n"),
          declarations: declarations.join("\n"),
        });
      } else {
        // It's a directory, look for names files instead
        themeScss.push({
          variables: read(join(theme, "_variables.scss")),
          rules: read(join(theme, "_rules.scss")),
          declarations: read(join(theme, "_declarations.scss")),
        });
      }
    }
  });
  return themeScss;
}

function mapBootstrapPandocVariables(metadata: Metadata): SassVariable[] {
  const explicitVars: SassVariable[] = [];

  // our code copy selector
  explicitVars.push({
    name: "code-copy-selector",
    value: metadata[kCodeCopy] === undefined || metadata[kCodeCopy] === "hover"
      ? "pre.sourceCode:hover > "
      : "",
  });

  // Helper for adding explicitly set variables
  const addIfDefined = (cssVar?: SassVariable) => {
    if (cssVar !== undefined) {
      explicitVars.push(cssVar);
    }
  };

  // Pass through to some bootstrap variables
  addIfDefined(
    sassVariable("line-height-base", metadata["linestretch"], asCssNumber),
  );
  addIfDefined(sassVariable("font-size-root", metadata["font-size"]));
  addIfDefined(sassVariable("body-bg", metadata["backgroundcolor"]));
  addIfDefined(sassVariable("body-color", metadata["fontcolor"]));
  addIfDefined(sassVariable("link-color", metadata["linkcolor"]));
  addIfDefined(
    sassVariable(
      "font-family-base",
      metadata["mainfont"],
      asCssFont,
    ),
  );
  addIfDefined(
    sassVariable("font-family-code", metadata["monofont"], asCssFont),
  );
  addIfDefined(
    sassVariable("mono-background-color", metadata["monobackgroundcolor"]),
  );

  // Deal with sizes
  const explicitSizes = [
    "max-width",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
  ];
  explicitSizes.forEach((attrib) => {
    addIfDefined(sassVariable(attrib, metadata[attrib], asCssSize));
  });

  return explicitVars;
}

// Quarto variables and styles
export const quartoBootstrapVariables = () =>
  formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-variables.scss"),
  );

export const quartoRules = () =>
  formatResourcePath(
    "html",
    "_quarto-rules.scss",
  );

export const quartoBootstrapRules = () =>
  formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-rules.scss"),
  );

export const quartoDeclarations = () =>
  formatResourcePath(
    "html",
    "_quarto-declarations.scss",
  );
