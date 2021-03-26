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

  // If any pandoc specific variables were provided, just pile them in here
  let documentVariables;
  const pandocVariables = mapBootstrapMetadataVariables(metadata);
  if (pandocVariables) {
    documentVariables = pandocVariables.map((variable) =>
      `$${variable.name}: ${variable.value};`
    ).join("\n");
  }
  return {
    dependency: kBootstrapDependencyName,
    key: themes.join("|"),
    user: {
      variables: themeVariables.join("\n\n"),
      declarations: themeDeclarations.join("\n\n"),
      rules: themeRules.join("\n\n"),
    },
    quarto: {
      use: ["sass:color", "sass:map"],
      variables: [
        Deno.readTextFileSync(quartoBootstrapVariables()),
      ].join(
        "\n\n",
      ),
      declarations: [
        Deno.readTextFileSync(quartoDeclarations()),
      ].join(
        "\n\n",
      ),
      rules: [
        Deno.readTextFileSync(quartoRules()),
        Deno.readTextFileSync(quartoBootstrapRules()),
      ].join("\n\n"),
    },
    framework: {
      variables: [
        documentVariables,
      ].join(
        "\n\n",
      ),
      declarations: "",
      rules: [
        Deno.readTextFileSync(boostrapRules),
      ].join("\n\n"),
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

export interface ScssVariable {
  name: string;
  value: string;
}

function mapBootstrapMetadataVariables(metadata: Metadata) {
  const explicitVars: ScssVariable[] = [];

  const addVariable = (cssVar?: ScssVariable) => {
    if (cssVar !== undefined) {
      explicitVars.push(cssVar);
    }
  };

  addVariable({
    name: "code-copy-selector",
    value: metadata[kCodeCopy] === undefined || metadata[kCodeCopy] === "hover"
      ? '"pre.sourceCode:hover > "'
      : '""',
  });

  // Map some variables to bootstrap vars
  addVariable(scssVarFromMetadata(
    metadata,
    "linestretch",
    "line-height-base",
    (val) => {
      return asCssNumber(val);
    },
  ));
  addVariable(scssVarFromMetadata(metadata, "font-size", "font-size-root"));
  addVariable(scssVarFromMetadata(
    metadata,
    "backgroundcolor",
    "body-bgr",
  ));
  addVariable(scssVarFromMetadata(metadata, "fontcolor", "body-color"));
  addVariable(scssVarFromMetadata(metadata, "linkcolor", "link-color"));
  addVariable(
    scssVarFromMetadata(
      metadata,
      "mainfont",
      "font-family-bootstrap",
      asCssFont,
    ),
  );
  addVariable(
    scssVarFromMetadata(metadata, "monofont", "font-family-code", asCssFont),
  );

  // Special case for Body width and margins
  const explicitSizes = [
    "max-width",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
  ];
  explicitSizes.forEach((attrib) => {
    if (metadata[attrib]) {
      const size = asCssSize(metadata[attrib]);
      if (size) {
        explicitVars.push({ name: attrib, value: size });
      }
    }
  });

  // Special case for mono background
  const monoBackground = scssVarFromMetadata(
    metadata,
    "monobackgroundcolor",
    "mono-background-color",
  );
  if (monoBackground) {
    // if we have a monobackground color then add padding
    explicitVars.push(monoBackground);
    explicitVars.push({ name: "mono-padding", value: "0.2em" });
  } else {
    // otherwise provide a default code block border treatment
    explicitVars.push({ name: "codeblock-padding-left", value: "0.6rem" });
    explicitVars.push({ name: "codeblock-border-left", value: "3px solid" });
  }
  return explicitVars;
}

function scssVarFromMetadata(
  metadata: Metadata,
  name: string,
  cssName: string,
  formatter?: (val: string) => string | undefined,
): ScssVariable | undefined {
  if (metadata[name] !== undefined) {
    const value = typeof (metadata[name]) === "string"
      ? metadata[name]
      : undefined;
    if (value !== undefined) {
      const formattedValue = formatter
        ? formatter(value as string)
        : value as string;

      if (formattedValue !== undefined) {
        return {
          name: cssName,
          value: formattedValue,
        };
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
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
