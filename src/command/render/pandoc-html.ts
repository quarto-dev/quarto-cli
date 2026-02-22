/*
 * pandoc-html.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { uniqBy } from "../../core/lodash.ts";

import {
  Format,
  FormatExtras,
  kDependencies,
  kQuartoCssVariables,
  kTextHighlightingMode,
  SassBundle,
  SassBundleWithBrand,
  SassLayer,
} from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";

import { cssImports, cssResources } from "../../core/css.ts";
import { cleanSourceMappingUrl, compileSass } from "../../core/sass.ts";

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
import { kMinimal } from "../../format/html/format-html-shared.ts";
import { kSassBundles } from "../../config/types.ts";
import { md5HashBytes } from "../../core/hash.ts";
import { InternalError } from "../../core/lib/error.ts";
import { assert } from "testing/asserts";
import { safeModeFromFile } from "../../deno_ral/fs.ts";
import { safeCloneDeep } from "../../core/safe-clone-deep.ts";

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
  format: Format,
  project: ProjectContext,
) {
  extras = safeCloneDeep(extras);

  const mergedBundles: Record<string, SassBundleWithBrand[]> = {};

  // groups the bundles by dependency name
  const group = (
    bundles: SassBundleWithBrand[],
    groupedBundles: Record<string, SassBundleWithBrand[]>,
  ) => {
    bundles.forEach((bundle) => {
      if (!groupedBundles[bundle.dependency]) {
        groupedBundles[bundle.dependency] = [];
      }
      groupedBundles[bundle.dependency].push(bundle);
    });
  };

  // group available sass bundles
  if (extras?.["html"]?.[kSassBundles]) {
    group(extras["html"][kSassBundles], mergedBundles);
  }

  // Go through and compile the cssPath for each dependency
  let hasDarkStyles = false;
  let defaultStyle: "dark" | "light" | undefined = undefined;
  for (const dependency of Object.keys(mergedBundles)) {
    // compile the cssPath
    const bundlesWithBrand = mergedBundles[dependency];
    // first, pull out the brand-specific layers
    //
    // the brand bundle itself doesn't have any 'brand' entries;
    // those are used to specify where the brand-specific layers should be inserted
    // in the final bundle.
    const maybeBrandBundle = bundlesWithBrand.find((bundle) =>
      bundle.key === "brand"
    );
    assert(
      !maybeBrandBundle ||
        !maybeBrandBundle.user?.find((v) => v === "brand") &&
          !maybeBrandBundle.dark?.user?.find((v) => v === "brand"),
    );
    const foundBrand = { light: false, dark: false };
    const bundles: SassBundle[] = bundlesWithBrand.filter((bundle) =>
      bundle.key !== "brand"
    ).map((bundle) => {
      const userBrand = bundle.user?.findIndex((layer) => layer === "brand");
      let cloned = false;
      if (userBrand && userBrand !== -1) {
        bundle = safeCloneDeep(bundle);
        cloned = true;
        bundle.user!.splice(userBrand, 1, ...(maybeBrandBundle?.user || []));
        foundBrand.light = true;
      }
      const darkBrand = bundle.dark?.user?.findIndex((layer) =>
        layer === "brand"
      );
      if (darkBrand && darkBrand !== -1) {
        if (!cloned) {
          bundle = safeCloneDeep(bundle);
        }
        bundle.dark!.user!.splice(
          darkBrand,
          1,
          ...(maybeBrandBundle?.dark?.user || []),
        );
        foundBrand.dark = true;
      }
      return bundle as SassBundle;
    });
    if (maybeBrandBundle && (!foundBrand.light || !foundBrand.dark)) {
      bundles.unshift({
        dependency,
        key: "brand",
        user: !foundBrand.light && maybeBrandBundle.user as SassLayer[] || [],
        dark: !foundBrand.dark && maybeBrandBundle.dark?.user && {
              user: maybeBrandBundle.dark.user as SassLayer[],
              default: maybeBrandBundle.dark.default,
            } || undefined,
      });
    }

    // See if any bundles are providing dark specific css
    const hasDark = bundles.some((bundle) => bundle.dark !== undefined);
    defaultStyle = bundles.some((bundle) =>
        bundle.dark !== undefined && bundle.dark.default
      )
      ? "dark"
      : "light";
    let targets: SassTarget[] = [{
      name: `${dependency}.min.css`,
      bundles: (bundles as any),
      attribs: {
        "append-hash": "true",
      },
    }];
    if (hasDark) {
      // Note that the other bundle provides light
      targets[0].attribs = {
        ...targets[0].attribs,
        ...attribForThemeStyle("light"),
      };

      // Provide a dark bundle for this
      const darkBundles = bundles.map((bundle) => {
        bundle = safeCloneDeep(bundle);
        bundle.user = bundle.dark?.user || bundle.user;
        bundle.quarto = bundle.dark?.quarto || bundle.quarto;
        bundle.framework = bundle.dark?.framework || bundle.framework;

        // Mark this bundle with a dark key so it is differentiated from the light theme
        bundle.key = bundle.key + "-dark";
        return bundle;
      });

      // Inject dark/light sentinel comments directly, rather than relying
      // on the SCSS blackness() heuristic which fails for perceptually-dark
      // colours with low HWB blackness (e.g. blue #0000FF).
      // See https://github.com/quarto-dev/quarto-cli/issues/14084
      darkBundles.push(darkModeSentinelBundle("dark"));
      bundles.push(darkModeSentinelBundle("light"));

      const darkTarget = {
        name: `${dependency}-dark.min.css`,
        bundles: darkBundles as any,
        attribs: {
          "append-hash": "true",
          ...attribForThemeStyle("dark"),
        },
      };
      if (defaultStyle === "dark") { // light, dark
        targets.push(darkTarget);
      } else { // light, dark, light
        const lightTargetExtra = {
          ...targets[0],
          attribs: {
            ...targets[0].attribs,
            class: "quarto-color-scheme-extra",
          },
        };

        targets = [
          targets[0],
          darkTarget,
          lightTargetExtra,
        ];
      }

      hasDarkStyles = true;
    } else {
      // Single-theme: detect dark/light via WCAG relative luminance,
      // which correctly handles saturated colours (unlike HWB blackness).
      bundles.push(darkModeSentinelBundle("detect"));
    }

    for (const target of targets) {
      let cssPath: string | undefined;
      cssPath = await compileSass(target.bundles, project);
      // First, Clean CSS
      cleanSourceMappingUrl(cssPath);
      // look for a sentinel 'dark' value, extract variables
      const cssResult = await processCssIntoExtras(cssPath, extras, project);
      cssPath = cssResult.path;

      // it can happen that processing generate an empty css file (e.g quarto-html deps with Quarto CSS variables)
      // in that case, no need to insert the cssPath in the dependency
      if (!cssPath) continue;
      if (Deno.readTextFileSync(cssPath).length === 0) {
        continue;
      }

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

        let targetName = target.name;
        if (target.attribs["append-hash"] === "true") {
          const hashFragment = `-${await md5HashBytes(
            Deno.readFileSync(cssPath),
          )}`;
          let extension = "";
          if (target.name.endsWith(".min.css")) {
            extension = ".min.css";
          } else if (target.name.endsWith(".css")) {
            extension = ".css";
          } else {
            throw new InternalError("Unexpected target name: " + target.name);
          }
          targetName =
            targetName.slice(0, target.name.length - extension.length) +
            hashFragment + extension;
        } else {
          targetName = target.name;
        }

        if (existingDependency) {
          if (!existingDependency.stylesheets) {
            existingDependency.stylesheets = [];
          }
          existingDependency.stylesheets.push({
            name: targetName,
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
              name: targetName,
              path: cssPath,
              attribs: target.attribs,
            }, ...imports],
            resources,
          });
        }
      }
    }
  }

  // light only: light
  // author prefers dark: light, dark
  // author prefers light: light, dark, light
  extras = await resolveQuartoSyntaxHighlighting(
    inputDir,
    extras,
    format,
    project,
    hasDarkStyles ? "light" : "default",
    defaultStyle,
  );

  if (hasDarkStyles) {
    // find the last entry, for the light highlight stylesheet
    // so we can duplicate it below.
    // (note we must do this before adding the dark highlight stylesheet)
    const lightDep = extras.html?.[kDependencies]?.find((extraDep) =>
      extraDep.name === kQuartoHtmlDependency
    );
    const lightEntry = lightDep?.stylesheets &&
      lightDep.stylesheets[lightDep.stylesheets.length - 1];
    extras = await resolveQuartoSyntaxHighlighting(
      inputDir,
      extras,
      format,
      project,
      "dark",
      defaultStyle,
    );
    if (defaultStyle === "light" && lightEntry) {
      const dep2 = extras.html?.[kDependencies]?.find((extraDep) =>
        extraDep.name === kQuartoHtmlDependency
      );
      assert(dep2?.stylesheets);
      dep2.stylesheets.push({
        ...lightEntry,
        attribs: {
          ...lightEntry.attribs,
          class: "quarto-color-scheme-extra",
        },
      });
    }
  }

  if (isHtmlOutput(format.pandoc, true)) {
    // We'll take care of text highlighting for HTML
    setTextHighlightStyle("none", extras);
  }

  return extras;
}

// Generates syntax highlighting Css and Css variables
async function resolveQuartoSyntaxHighlighting(
  inputDir: string,
  extras: FormatExtras,
  format: Format,
  project: ProjectContext,
  style: "dark" | "light" | "default",
  defaultStyle?: "dark" | "light",
) {
  // if
  const minimal = format.metadata[kMinimal] === true;
  if (minimal) {
    return extras;
  }

  extras = safeCloneDeep(extras);

  // If we're using default highlighting, use theme darkness to select highlight style
  const mediaAttr = attribForThemeStyle(style);
  if (style === "default") {
    if (extras.html?.[kTextHighlightingMode] === "dark") {
      style = "dark";
    }
  }
  mediaAttr.id = "quarto-text-highlighting-styles";

  // Generate and inject the text highlighting css
  const cssFileName = `quarto-syntax-highlighting${
    style === "dark" ? "-dark" : ""
  }`;

  // Read the highlight style (theme name)
  const themeDescriptor = readHighlightingTheme(inputDir, format.pandoc, style);
  if (themeDescriptor) {
    // Other variables that need to be injected (if any)
    const extraVariables = extras.html?.[kQuartoCssVariables] || [];
    for (let i = 0; i < extraVariables.length; ++i) {
      // For the same reason as outlined in https://github.com/rstudio/bslib/issues/1104,
      // we need to patch the text to include a semicolon inside the declaration
      // if it doesn't have one.
      // This happens because scss-parser is brittle, and will fail to parse a declaration
      // if it doesn't end with a semicolon.
      //
      // In addition, we know that some our variables come from the output
      // of sassCompile which
      // - misses the last semicolon
      // - emits a :root declaration
      // - triggers the scss-parser bug
      // So we'll attempt to target the last declaration in the :root
      // block specifically and add a semicolon if it doesn't have one.
      let variable = extraVariables[i].trim();
      if (
        variable.endsWith("}") && variable.startsWith(":root") &&
        !variable.match(/.*;\s?}$/)
      ) {
        variable = variable.slice(0, -1) + ";}";
        extraVariables[i] = variable;
      }
    }

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
      rules.push(".prevent-inlining { content: '</'; }");

      // Compile the scss
      const highlightCssPath = await compileSass(
        [{
          key: cssFileName + ".css",
          quarto: {
            uses: "",
            defaults: "",
            functions: "",
            mixins: "",
            rules: rules.join("\n"),
          },
        }],
        project,
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

          const hash = await md5HashBytes(Deno.readFileSync(highlightCssPath));
          existingDependency.stylesheets.push({
            name: cssFileName + `-${hash}.css`,
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
    const otherLines: string[] = [];
    otherLines.push("/* syntax highlight based on Pandoc's rules */");
    const tokenCssByAbbr: Record<string, string[]> = {};

    const toCSS = function (
      abbr: string,
      styleName: string,
      cssValues: string[],
    ) {
      const lines: string[] = [];
      lines.push(`/* ${styleName} */`);
      lines.push(`\ncode span${abbr !== "" ? `.${abbr}` : ""} {`);
      cssValues.forEach((value) => {
        lines.push(`  ${value}`);
      });
      lines.push("}\n");

      // Store by abbreviation for sorting later
      tokenCssByAbbr[abbr] = lines;
    };

    Object.keys(textStyles).forEach((styleName) => {
      const abbr = kAbbrevs[styleName];
      if (abbr !== undefined) {
        const textValues = textStyles[styleName];
        const cssValues = generateCssKeyValues(textValues);

        toCSS(abbr, styleName, cssValues);

        if (abbr == "") {
          [
            "pre > code.sourceCode > span",
            "code.sourceCode > span",
            "div.sourceCode,\ndiv.sourceCode pre.sourceCode",
          ]
            .forEach((selector) => {
              otherLines.push(`\n${selector} {`);
              otherLines.push(...cssValues);
              otherLines.push("}\n");
            });
        }
      }
    });

    // Sort tokenCssLines by abbr and flatten them
    // Ensure empty abbr ("") comes first by using a custom sort function
    const sortedTokenCssLines: string[] = [];
    Object.keys(tokenCssByAbbr)
      .sort((a, b) => {
        // Empty string ("") should come first
        if (a === "") return -1;
        if (b === "") return 1;
        // Otherwise normal alphabetical sort
        return a.localeCompare(b);
      })
      .forEach((abbr) => {
        sortedTokenCssLines.push(...tokenCssByAbbr[abbr]);
      });

    // return otherLines followed by tokenCssLines (now sorted by abbr)
    return otherLines.concat(sortedTokenCssLines);
  }
  return undefined;
}

interface CSSResult {
  path: string | undefined;
  dark: boolean;
}

// Processes CSS into format extras (scanning for variables and removing them)
async function processCssIntoExtras(
  cssPath: string,
  extras: FormatExtras,
  project: ProjectContext,
): Promise<CSSResult> {
  const { temp } = project;
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
      const cleanedCss = css.replaceAll(kVariablesRegex, "");
      let newCssPath: string | undefined;
      if (cleanedCss.trim() === "") {
        newCssPath = undefined;
      } else {
        const hash = await md5HashBytes(new TextEncoder().encode(cleanedCss));
        newCssPath = temp.createFile({ suffix: `-${hash}.css` });
        Deno.writeTextFileSync(newCssPath, cleanedCss, {
          mode: safeModeFromFile(cssPath),
        });
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

// Creates a SassBundle that injects the dark/light mode sentinel comment
// into compiled CSS. For dual-theme builds the mode is known at build time;
// for single-theme builds we detect via oklch perceptual lightness.
function darkModeSentinelBundle(
  mode: "dark" | "light" | "detect",
): SassBundle {
  let uses = "";
  let defaults = "";
  let sentinelRules: string;

  if (mode === "detect") {
    uses = '@use "sass:color";';
    defaults = "$body-bg: #fff !default;\n";
    sentinelRules = [
      '@if (color.channel($body-bg, "lightness", $space: oklch) < 50%) {',
      "  /*! dark */",
      "} @else {",
      "  /*! light */",
      "}",
    ].join("\n");
  } else {
    sentinelRules = `/*! ${mode} */`;
  }

  return {
    dependency: "quarto-dark-sentinel",
    key: `quarto-${mode}-sentinel`,
    quarto: {
      uses,
      defaults,
      functions: "",
      mixins: "",
      rules: sentinelRules,
    },
  };
}

// Attributes for the style tag
function attribForThemeStyle(
  style: "dark" | "light" | "default",
): Record<string, string> {
  const colorModeAttrs = (mode: string) => {
    const attr: Record<string, string> = {
      class: `quarto-color-scheme${
        mode === "dark" ? " quarto-color-alternate" : ""
      }`,
    };
    return attr;
  };

  switch (style) {
    case "dark":
      return colorModeAttrs("dark");
    case "light":
      return colorModeAttrs("light");
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
