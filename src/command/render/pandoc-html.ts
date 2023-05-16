/*
 * pandoc-html.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";
import { cloneDeep, uniqBy } from "../../core/lodash.ts";

import {
  FormatExtras,
  FormatPandoc,
  kDependencies,
  kQuartoCssVariables,
  kTextHighlightingMode,
  SassBundle,
} from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";

import { TempContext } from "../../core/temp.ts";
import { cssImports, cssResources } from "../../core/css.ts";
import { compileSass } from "../../core/sass.ts";

import { kQuartoHtmlDependency } from "../../format/html/format-html-constants.ts";
import {
  kAbbrevs,
  readHighlightingTheme,
} from "../../quarto-core/text-highlighting.ts";

import { isHtmlOutput } from "../../config/format.ts";
import {
  cssHasDarkModeSentinel,
  generateCssKeyValues,
} from "../../core/pandoc/css.ts";

// The output target for a sass bundle
// (controls the overall style tag that is emitted)
interface SassTarget {
  name: string;
  bundles: SassBundle[];
  attribs: Record<string, string>;
}

export async function resolveSassBundles(
  inputDir: string,
  extras: FormatExtras,
  pandoc: FormatPandoc,
  temp: TempContext,
  formatBundles?: SassBundle[],
  projectBundles?: SassBundle[],
  project?: ProjectContext,
) {
  extras = cloneDeep(extras);

  const mergedBundles: Record<string, SassBundle[]> = {};

  // groups the bundles by dependency name
  const group = (
    bundles: SassBundle[],
    groupedBundles: Record<string, SassBundle[]>,
  ) => {
    bundles.forEach((bundle) => {
      if (!groupedBundles[bundle.dependency]) {
        groupedBundles[bundle.dependency] = [];
      }
      groupedBundles[bundle.dependency].push(bundle);
    });
  };

  // group project provided bundles
  if (projectBundles) {
    group(projectBundles, mergedBundles);
  }

  // group format provided bundles
  if (formatBundles) {
    group(formatBundles, mergedBundles);
  }

  // Go through and compile the cssPath for each dependency
  let hasDarkStyles = false;
  let defaultStyle: "dark" | "light" | undefined = undefined;
  for (const dependency of Object.keys(mergedBundles)) {
    // compile the cssPath
    const bundles = mergedBundles[dependency];

    // See if any bundles are providing dark specific css
    const hasDark = bundles.some((bundle) => bundle.dark !== undefined);
    defaultStyle = bundles.some((bundle) =>
        bundle.dark !== undefined && bundle.dark.default
      )
      ? "dark"
      : "light";

    const targets: SassTarget[] = [{
      name: `${dependency}.min.css`,
      bundles,
      attribs: {},
    }];
    if (hasDark) {
      // Note that the other bundle provides light
      targets[0].attribs = {
        ...targets[0].attribs,
        ...attribForThemeStyle("light", defaultStyle),
      };

      // Provide a dark bundle for this
      const darkBundles = bundles.map((bundle) => {
        bundle = cloneDeep(bundle);
        bundle.user = bundle.dark?.user || bundle.user;
        bundle.quarto = bundle.dark?.quarto || bundle.quarto;
        bundle.framework = bundle.dark?.framework || bundle.framework;

        // Mark this bundle with a dark key so it is differentiated from the light theme
        bundle.key = bundle.key + "-dark";
        return bundle;
      });
      targets.push({
        name: `${dependency}-dark.min.css`,
        bundles: darkBundles,
        attribs: attribForThemeStyle("dark", defaultStyle),
      });

      hasDarkStyles = true;
    }

    for (const target of targets) {
      let cssPath = await compileSass(target.bundles, temp);

      // look for a sentinel 'dark' value, extract variables
      const cssResult = processCssIntoExtras(cssPath, extras, temp);
      cssPath = cssResult.path;
      // Process attributes (forward on to the target)
      for (const bundle of target.bundles) {
        if (bundle.attribs) {
          for (const key of Object.keys(bundle.attribs)) {
            if (target.attribs[key] === undefined) {
              target.attribs[key] = bundle.attribs[key];
            }
          }
        }
      }
      target.attribs["data-mode"] = cssResult.dark ? "dark" : "light";

      // Find any imported stylesheets or url references
      // (These could come from user scss that is merged into our theme, for example)
      const css = Deno.readTextFileSync(cssPath);
      const toDependencies = (paths: string[]) => {
        return paths.map((path) => {
          return {
            name: path,
            path: project ? join(project.dir, path) : path,
            attribs: target.attribs,
          };
        });
      };
      const resources = toDependencies(cssResources(css));
      const imports = toDependencies(cssImports(css));

      // Push the compiled Css onto the dependency
      const extraDeps = extras.html?.[kDependencies];

      if (extraDeps) {
        const existingDependency = extraDeps.find((extraDep) =>
          extraDep.name === dependency
        );

        if (existingDependency) {
          if (!existingDependency.stylesheets) {
            existingDependency.stylesheets = [];
          }
          existingDependency.stylesheets.push({
            name: target.name,
            path: cssPath,
            attribs: target.attribs,
          });

          // Add any css references
          existingDependency.stylesheets.push(...imports);
          existingDependency.resources?.push(...resources);
        } else {
          extraDeps.push({
            name: dependency,
            stylesheets: [{
              name: target.name,
              path: cssPath,
              attribs: target.attribs,
            }, ...imports],
            resources,
          });
        }
      }
    }
  }

  // Resolve generated quarto css variables
  extras = await resolveQuartoSyntaxHighlighting(
    inputDir,
    extras,
    pandoc,
    temp,
    hasDarkStyles ? "light" : "default",
    defaultStyle,
  );

  if (hasDarkStyles) {
    // Provide dark variables for this
    extras = await resolveQuartoSyntaxHighlighting(
      inputDir,
      extras,
      pandoc,
      temp,
      "dark",
      defaultStyle,
    );
  }

  if (isHtmlOutput(pandoc, true)) {
    // We'll take care of text highlighting for HTML
    setTextHighlightStyle("none", extras);
  }

  return extras;
}

// Generates syntax highlighting Css and Css variables
async function resolveQuartoSyntaxHighlighting(
  inputDir: string,
  extras: FormatExtras,
  pandoc: FormatPandoc,
  temp: TempContext,
  style: "dark" | "light" | "default",
  defaultStyle?: "dark" | "light",
) {
  extras = cloneDeep(extras);

  // If we're using default highlighting, use theme darkness to select highlight style
  const mediaAttr = attribForThemeStyle(style, defaultStyle);
  if (style === "default") {
    if (extras.html?.[kTextHighlightingMode] === "dark") {
      style = "dark";
    }
  }
  mediaAttr.id = "quarto-text-highlighting-styles";

  // Generate and inject the text highlighting css
  const cssFileName = `quarto-syntax-highlighting${
    style === "dark" ? "-dark" : ""
  }.css`;

  // Read the highlight style (theme name)
  const themeDescriptor = readHighlightingTheme(inputDir, pandoc, style);
  if (themeDescriptor) {
    // Other variables that need to be injected (if any)
    const extraVariables = extras.html?.[kQuartoCssVariables] || [];

    // The text highlighting CSS variables
    const highlightCss = generateThemeCssVars(themeDescriptor.json);
    if (highlightCss) {
      const rules = [
        highlightCss,
        "",
        "/* other quarto variables */",
        ...extraVariables,
      ];

      // The text highlighting CSS rules
      const textHighlightCssRules = generateThemeCssClasses(
        themeDescriptor.json,
      );
      if (textHighlightCssRules) {
        rules.push(...textHighlightCssRules);
      }

      // Add this string literal to the rule set, which prevents pandoc
      // from inlining this style sheet
      // See https://github.com/jgm/pandoc/commit/7c0a80c323f81e6262848bfcfc922301e3f406e0
      rules.push(".prevent-inlining { content: '</' }");

      // Compile the scss
      const highlightCssPath = await compileSass(
        [{
          key: cssFileName,
          quarto: {
            uses: "",
            defaults: "",
            functions: "",
            mixins: "",
            rules: rules.join("\n"),
          },
        }],
        temp,
        false,
      );

      // Find the bootstrap or quarto-html dependency and inject this stylesheet
      const extraDeps = extras.html?.[kDependencies];
      if (extraDeps) {
        // Inject an scss variable for setting the background color of code blocks
        // with defaults, before the other bootstrap variables?
        // don't put it in css (basically use the value to set the default), allow
        // default to be override by user

        const quartoDependency = extraDeps.find((extraDep) =>
          extraDep.name === kQuartoHtmlDependency
        );
        const existingDependency = quartoDependency;
        if (existingDependency) {
          existingDependency.stylesheets = existingDependency.stylesheets ||
            [];

          existingDependency.stylesheets.push({
            name: cssFileName,
            path: highlightCssPath,
            attribs: mediaAttr,
          });
        }
      }
    }
  }
  return extras;
}

// Generates CSS variables based upon the syntax highlighting rules in a theme file
function generateThemeCssVars(
  themeJson: Record<string, unknown>,
) {
  const textStyles = themeJson["text-styles"] as Record<
    string,
    Record<string, unknown>
  >;
  if (textStyles) {
    const lines: string[] = [];
    lines.push("/* quarto syntax highlight colors */");
    lines.push(":root {");
    Object.keys(textStyles).forEach((styleName) => {
      const abbr = kAbbrevs[styleName];
      if (abbr) {
        const textValues = textStyles[styleName];
        Object.keys(textValues).forEach((textAttr) => {
          switch (textAttr) {
            case "text-color":
              lines.push(
                `  --quarto-hl-${abbr}-color: ${
                  textValues[textAttr] ||
                  "inherit"
                };`,
              );
              break;
          }
        });
      }
    });
    lines.push("}");
    return lines.join("\n");
  }
  return undefined;
}

// Generates CSS rules based upon the syntax highlighting rules in a theme file
function generateThemeCssClasses(
  themeJson: Record<string, unknown>,
) {
  const textStyles = themeJson["text-styles"] as Record<
    string,
    Record<string, unknown>
  >;
  if (textStyles) {
    const lines: string[] = [];

    Object.keys(textStyles).forEach((styleName) => {
      const abbr = kAbbrevs[styleName];
      if (abbr !== undefined) {
        const textValues = textStyles[styleName];
        const cssValues = generateCssKeyValues(textValues);

        if (abbr !== "") {
          lines.push(`\ncode span.${abbr} {`);
          lines.push(...cssValues);
          lines.push("}\n");
        } else {
          [
            "pre > code.sourceCode > span",
            "code span",
            "code.sourceCode > span",
            "div.sourceCode,\ndiv.sourceCode pre.sourceCode",
          ]
            .forEach((selector) => {
              lines.push(`\n${selector} {`);
              lines.push(...cssValues);
              lines.push("}\n");
            });
        }
      }
    });
    return lines;
  }
  return undefined;
}

interface CSSResult {
  path: string;
  dark: boolean;
}

// Processes CSS into format extras (scanning for variables and removing them)
function processCssIntoExtras(
  cssPath: string,
  extras: FormatExtras,
  temp: TempContext,
): CSSResult {
  extras.html = extras.html || {};
  const css = Deno.readTextFileSync(cssPath);

  // Extract dark sentinel value
  const hasDarkSentinel = cssHasDarkModeSentinel(css);
  if (!extras.html[kTextHighlightingMode] && hasDarkSentinel) {
    setTextHighlightStyle("dark", extras);
  }

  // Extract variables
  const matches = css.matchAll(kVariablesRegex);
  if (matches) {
    extras.html[kQuartoCssVariables] = extras.html[kQuartoCssVariables] || [];
    let dirty = false;
    for (const match of matches) {
      const variables = match[1];
      extras.html[kQuartoCssVariables]?.push(variables);
      dirty = true;
    }

    // Don't include duplicate variables
    extras.html[kQuartoCssVariables] = uniqBy(
      extras.html[kQuartoCssVariables],
      (val: string) => {
        return val;
      },
    );

    if (dirty) {
      const cleanedCss = css.replaceAll(kVariablesRegex, "").replaceAll(
        kSourceMappingRegex,
        "",
      );
      const newCssPath = temp.createFile({ suffix: ".css" });

      // Preserve the existing permissions if possible
      // See https://github.com/quarto-dev/quarto-cli/issues/660
      let mode;
      if (Deno.build.os !== "windows") {
        const stat = Deno.statSync(cssPath);
        if (stat.mode !== null) {
          mode = stat.mode;
        }
      }

      if (mode !== undefined) {
        Deno.writeTextFileSync(newCssPath, cleanedCss, { mode });
      } else {
        Deno.writeTextFileSync(newCssPath, cleanedCss);
      }

      return {
        dark: hasDarkSentinel,
        path: newCssPath,
      };
    }
  }
  return {
    dark: hasDarkSentinel,
    path: cssPath,
  };
}
const kVariablesRegex =
  /\/\*\! quarto-variables-start \*\/([\S\s]*)\/\*\! quarto-variables-end \*\//g;
const kSourceMappingRegex = /\/\*\# sourceMappingURL=.* \*\//g;

// Attributes for the style tag
// Note that we default disable the dark mode and rely on JS to enable it
function attribForThemeStyle(
  style: "dark" | "light" | "default",
  defaultStyle?: "dark" | "light",
): Record<string, string> {
  const colorModeAttrs = (mode: string, disabled: boolean) => {
    const attr: Record<string, string> = {
      class: `quarto-color-scheme${
        mode === "dark" ? " quarto-color-alternate" : ""
      }`,
    };
    if (disabled) {
      attr.rel = "prefetch";
    }
    return attr;
  };

  switch (style) {
    case "dark":
      return colorModeAttrs("dark", defaultStyle !== "dark");
    case "light":
      return colorModeAttrs("light", false);
    case "default":
    default:
      return {};
  }
}

// Note the text highlight style in extras
export function setTextHighlightStyle(
  style: "light" | "dark" | "none",
  extras: FormatExtras,
) {
  extras.html = extras.html || {};
  extras.html[kTextHighlightingMode] = style;
}
