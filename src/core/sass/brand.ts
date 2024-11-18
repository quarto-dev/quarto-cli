/*
 * brand.ts
 *
 * Generate SASS bundles from `_brand.yml`
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import {
  Format,
  FormatExtras,
  kSassBundles,
  SassBundle,
  SassLayer,
} from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  BrandFont,
  BrandFontBunny,
  BrandFontCommon,
  BrandFontGoogle,
  BrandFontWeight,
} from "../../resources/types/schema-types.ts";
import { Brand } from "../brand/brand.ts";

const defaultColorNameMap: Record<string, string> = {
  "link-color": "link",
  "pre-color": "foreground",
  "body-bg": "background",
  "body-color": "foreground",
  "body-secondary-color": "secondary",
  "body-secondary": "secondary",
  "body-tertiary-color": "tertiary",
  "body-tertiary": "secondary",
};

const brandFontWeightValue: (weight: BrandFontWeight) => number = (weight) => {
  if (typeof weight === "number") {
    return weight;
  }
  // from https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
  // excluding 950
  const stringMap: Record<string, number> = {
    thin: 100,
    "extra-light": 200,
    "ultra-light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    "semi-bold": 600,
    "demi-bold": 600,
    bold: 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    black: 900,
  };
  const result = stringMap[weight];
  if (result === undefined) {
    throw new Error(`Unknown font weight ${weight}`);
  }
  return result;
};

export async function brandBootstrapSassBundles(
  fileName: string | undefined,
  project: ProjectContext,
  key: string,
): Promise<SassBundle[]> {
  const layers = await brandBootstrapSassLayers(
    fileName,
    project,
    defaultColorNameMap,
  );
  return [{
    key,
    dependency: "bootstrap",
    user: layers,
  }];
}

const bunnyFontImportString = (description: BrandFontCommon) => {
  const bunnyName = (name: string) => name.replace(/ /g, "-");
  const bunnyFamily = description.family;
  if (!bunnyFamily) {
    throw new Error("Bunny font family not specified");
  }
  const styles = !description.style
    ? ["normal", "italic"]
    : typeof description.style === "string"
    ? [description.style]
    : description.style;
  const weightArray = !description.weight
    ? [400, 700]
    : typeof description.weight === "number" ||
        typeof description.weight === "string"
    ? [brandFontWeightValue(description.weight)]
    : description.weight.map((w) => brandFontWeightValue(w));
  const display = description.display ?? "swap";
  const weights = styles.includes("italic")
    ? weightArray.map((w) => `${w}i`).join(",") +
      "," +
      weightArray.join(",")
    : weightArray.join(",");
  // @import url(https://fonts.bunny.net/css?family=albert-sans:200i,400,700);
  return `@import url('https://fonts.bunny.net/css?family=${
    bunnyName(bunnyFamily)
  }:${weights}&display=${display}');`;
};

const googleFontImportString = (description: BrandFontGoogle) => {
  const googleFamily = typeof description === "string"
    ? description
    : description.family;
  const styles = !description.style
    ? ["normal", "italic"]
    : typeof description.style === "string"
    ? [description.style]
    : description.style;
  const weightArray = !description.weight
    ? [400, 700]
    : typeof description.weight === "number" ||
        typeof description.weight === "string"
    ? [brandFontWeightValue(description.weight)]
    : description.weight.map((w) => brandFontWeightValue(w));
  const display = description.display ?? "swap";
  let styleString = "";
  let weights = "";

  if (styles.includes("italic")) {
    styleString = "ital,";
    weights = weightArray.map((w) => `0,${w}`).join(";") +
      ";" +
      weightArray.map((w) => `1,${w}`).join(";");
  } else {
    weights = !description.weight ? "400;700" : weightArray.join(";");
  }
  return `@import url('https://fonts.googleapis.com/css2?family=${
    googleFamily!.replace(
      / /g,
      "+",
    )
  }:${styleString}wght@${weights}&display=${display}');`;
};

const brandColorLayer = (
  brand: Brand,
  nameMap: Record<string, string>,
): SassLayer => {
  const colorVariables: string[] = [
    "/* color variables from _brand.yml */",
    '// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml color" }',
  ];
  const colorCssVariables: string[] = [
    "/* color CSS variables from _brand.yml */",
    '// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml color" }',
    ":root {",
  ];

  // Create `brand-` prefixed Sass and CSS variables from color.palette
  for (const colorKey of Object.keys(brand.data?.color?.palette ?? {})) {
    const colorVar = colorKey.replace(/[^a-zA-Z0-9_-]+/g, "-");
    colorVariables.push(
      `$brand-${colorVar}: ${brand.getColor(colorKey)} !default;`,
    );
    colorCssVariables.push(
      `  --brand-${colorVar}: ${brand.getColor(colorKey)};`,
    );
  }

  // Map theme colors directly to Sass variables
  for (const colorKey of Object.keys(brand.data.color ?? {})) {
    if (colorKey === "palette") {
      continue;
    }
    colorVariables.push(
      `$${colorKey}: ${brand.getColor(colorKey)} !default;`,
    );
  }

  // format-specific name mapping
  for (const [key, value] of Object.entries(nameMap)) {
    const resolvedValue = brand.getColor(value);
    if (resolvedValue !== value) {
      colorVariables.push(
        `$${key}: ${resolvedValue} !default;`,
      );
    }
  }
  // const colorEntries = Object.keys(brand.color);
  colorVariables.push('// quarto-scss-analysis-annotation { "action": "pop" }');
  colorCssVariables.push(
    "}",
    '// quarto-scss-analysis-annotation { "action": "pop" }',
  );
  return {
    defaults: colorVariables.join("\n"),
    uses: "",
    functions: "",
    mixins: "",
    rules: colorCssVariables.join("\n"),
  };
};

type BootstrapDefaultsConfig = {
  uses?: string;
  functions?: string;
  defaults?: Record<string, Record<string, string | boolean | number | null>>;
  mixins?: string;
  rules?: string;
};

const brandDefaultsBootstrapLayer = (
  brand: Brand,
): SassLayer => {
  // Bootstrap Variables from brand.defaults.bootstrap
  const brandBootstrap = brand?.data?.defaults
    ?.bootstrap as unknown as BootstrapDefaultsConfig;

  const bsVariables: string[] = [
    "/* Bootstrap variables from _brand.yml */",
    '// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml defaults.bootstrap.defaults" }',
  ];
  const bsDefaults = brandBootstrap.defaults || "";
  if (typeof bsDefaults === "string") {
    bsVariables.push(bsDefaults);
  } else if (typeof bsDefaults === "object") {
    for (const bsVar of Object.keys(bsDefaults)) {
      bsVariables.push(`$${bsVar}: ${bsDefaults[bsVar]} !default;`);
    }
  } else {
    throw new Error(
      "Invalid bootstrap defaults in _brand.yml or `brand`. " +
        "`defaults.bootstrap.defaults` expects a string or a dictionary  " +
        "mapping Sass variables to default values.",
    );
  }
  bsVariables.push('// quarto-scss-analysis-annotation { "action": "pop" }');

  // Bootstrap Colors from color.palette
  // https://getbootstrap.com/docs/5.3/customize/color/#color-sass-maps
  const bootstrapColorVariables = [
    "black",
    "white",
    "blue",
    "indigo",
    "purple",
    "pink",
    "red",
    "orange",
    "yellow",
    "green",
    "teal",
    "cyan",
  ];

  const bsColors: string[] = [
    "/* Bootstrap color variables from _brand.yml */",
    '// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml color.palette" }',
  ];

  if (bootstrapColorVariables.length > 0) {
    for (const colorKey of Object.keys(brand.data?.color?.palette ?? {})) {
      if (!bootstrapColorVariables.includes(colorKey)) {
        continue;
      }

      bsColors.push(`$${colorKey}: ${brand.getColor(colorKey)} !default;`);
    }
  }

  bsColors.push('// quarto-scss-analysis-annotation { "action": "pop" }');

  const scssWithQuartoAnnotation = (
    x: string | undefined,
    origin: string,
  ): string => {
    if (!x) {
      return "";
    }

    return [
      `// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml defaults.bootstrap.${origin}" }`,
      x,
      '// quarto-scss-analysis-annotation { "action": "pop" }',
    ].join("\n");
  };

  return {
    defaults: bsColors.join("\n") + "\n" + bsVariables.join("\n"),
    uses: scssWithQuartoAnnotation(brandBootstrap.uses, "uses"),
    functions: scssWithQuartoAnnotation(
      brandBootstrap.functions,
      "functions",
    ),
    mixins: scssWithQuartoAnnotation(brandBootstrap.mixins, "mixins"),
    rules: scssWithQuartoAnnotation(brandBootstrap.rules, "rules"),
  };
};

const brandTypographyLayer = (
  brand: Brand,
): SassLayer => {
  const typographyVariables: string[] = [
    "/* typography variables from _brand.yml */",
    '// quarto-scss-analysis-annotation { "action": "push", "origin": "_brand.yml typography" }',
  ];
  const typographyImports: Set<string> = new Set();
  const fonts = brand.data?.typography?.fonts ?? [];

  const getFontFamilies = (family: string | undefined) => {
    return fonts.filter((font) =>
      typeof font !== "string" && font.family === family
    );
  };

  const resolveGoogleFontFamily = (
    font: BrandFont[],
  ): string | undefined => {
    let googleFamily = "";
    for (const _resolvedFont of font) {
      const resolvedFont = _resolvedFont as (BrandFontGoogle | BrandFontBunny);
      if (resolvedFont.source !== "google") {
        return undefined;
      }
      const thisFamily = resolvedFont.family;
      if (!thisFamily) {
        continue;
      }
      if (googleFamily === "") {
        googleFamily = thisFamily;
      } else if (googleFamily !== thisFamily) {
        throw new Error(
          `Inconsistent Google font families found: ${googleFamily} and ${thisFamily}`,
        );
      }
      typographyImports.add(googleFontImportString(resolvedFont));
    }
    if (googleFamily === "") {
      return undefined;
    }
    return googleFamily;
  };

  const resolveBunnyFontFamily = (
    font: BrandFont[],
  ): string | undefined => {
    let googleFamily = "";
    for (const _resolvedFont of font) {
      const resolvedFont =
        _resolvedFont as (BrandFont | BrandFontGoogle | BrandFontBunny);
      // Typescript's type checker doesn't understand that it's ok to attempt
      // to access a property that might not exist on a type when you're
      // only testing for its existence.

      // deno-lint-ignore no-explicit-any
      const source = (resolvedFont as any).source;
      if (source && source !== "bunny") {
        return undefined;
      }
      const thisFamily = resolvedFont.family;
      if (!thisFamily) {
        continue;
      }
      if (googleFamily === "") {
        googleFamily = thisFamily;
      } else if (googleFamily !== thisFamily) {
        throw new Error(
          `Inconsistent Google font families found: ${googleFamily} and ${thisFamily}`,
        );
      }
      typographyImports.add(bunnyFontImportString(resolvedFont));
    }
    if (googleFamily === "") {
      return undefined;
    }
    return googleFamily;
  };

  type HTMLFontInformation = { [key: string]: unknown };

  type FontKind =
    | "base"
    | "headings"
    | "monospace"
    | "monospace-block"
    | "monospace-inline";
  const resolveHTMLFontInformation = (
    kind: FontKind,
  ): HTMLFontInformation | undefined => {
    let resolvedFontOptions = brand.data.typography?.[kind];
    if (!resolvedFontOptions) {
      return undefined;
    } else if (typeof resolvedFontOptions === "string") {
      resolvedFontOptions = { family: resolvedFontOptions };
    }
    const family = resolvedFontOptions.family;
    const font = getFontFamilies(family);
    const result: HTMLFontInformation = {};
    result.family = resolveGoogleFontFamily(font) ??
      resolveBunnyFontFamily(font) ??
      // resolveFilesFontFamily(font) ??
      family;
    for (
      const entry of [
        "line-height",
        "size",
        "weight",
        "style",
        "color",
        "background-color",
        "decoration",
      ]
    ) {
      // deno-lint-ignore no-explicit-any
      if ((resolvedFontOptions as any)[entry]) {
        // deno-lint-ignore no-explicit-any
        result[entry] = (resolvedFontOptions as any)[entry];
      }
    }
    return result;
  };

  const variableTranslations: Record<string, [string, string][]> = {
    "base": [
      // bootstrap
      ["family", "font-family-base"],
      ["size", "font-size-base"],
      ["line-height", "line-height-base"],
      ["weight", "font-weight-base"],

      // revealjs
      ["family", "mainFont"],
      ["size", "presentation-font-size-root"],
      ["line-height", "presentation-line-height"],
      // TBD?

      // mermaid
      ["family", "mermaid-font-family"],
      ["weight", "mermaid-font-weight"],
      // ["style", "font-style-base"],
      // ["weight", "font-weight-base"],
    ],
    "headings": [
      // bootstrap
      ["family", "headings-font-family"],
      ["line-height", "headings-line-height"],
      ["weight", "headings-font-weight"],
      ["weight", "h1h2h3-font-weight"],
      ["color", "headings-color"],
      ["style", "headings-font-style"],

      // revealjs
      ["family", "presentation-heading-font"],
      ["line-height", "presentation-heading-line-height"],
      ["weight", "presentation-heading-font-weight"],
      ["color", "presentation-heading-color"],
      // TODO: style, needs CSS change
    ],
    "link": [
      // bootstrap + revealjs
      ["color", "link-color"],
      ["background-color", "link-color-bg"],
      ["weight", "link-weight"],
      ["decoration", "link-decoration"],
    ],
    "monospace": [
      // bootstrap + revealjs
      ["family", "font-family-monospace"],
      // bootstrap
      ["size", "code-font-size"],
      // forward explicitly to both `code` and `pre`
      // because that interacts less with the default bootstrap styles
      ["color", "code-color"], // this is also revealjs
      ["color", "pre-color"],

      ["weight", "font-weight-monospace"],

      // revealjs
      ["size", "code-block-font-size"],
      ["color", "code-block-color"],

      // monospace forwards to both block and inline
      ["background-color", "code-bg"],
      ["background-color", "code-block-bg"],
    ],
    "monospace-block": [
      // bootstrap + revealjs
      ["family", "font-family-monospace-block"],
      // bootstrap
      ["line-height", "pre-line-height"],
      ["color", "pre-color"],
      ["background-color", "pre-bg"],
      ["size", "code-block-font-size"],
      ["weight", "font-weight-monospace-block"],
      // revealjs
      ["line-height", "code-block-line-height"],
      ["color", "code-block-color"],
      ["background-color", "code-block-bg"],
    ],
    "monospace-inline": [
      // bootstrap + revealjs
      ["family", "font-family-monospace-inline"],
      ["color", "code-color"],
      ["background-color", "code-bg"],
      // bootstrap
      ["size", "code-inline-font-size"],
      ["weight", "font-weight-monospace-inline"],
      // revealjs
      // ["size", "code-block-font-size"],
    ],
  };

  for (
    const kind of [
      // more specific entries go first
      "link",
      "monospace-block",
      "monospace-inline",
      "monospace",
      "headings",
      "base",
    ]
  ) {
    const fontInformation = resolveHTMLFontInformation(
      kind as FontKind,
    );
    if (!fontInformation) {
      continue;
    }
    const variables = variableTranslations[kind];
    if (!variables) {
      throw new Error(`Unknown typography kind ${kind}`);
    }
    for (const variable of variables) {
      const source = variable[0];
      const target = variable[1];
      if (fontInformation[source]) {
        let value = fontInformation[source];
        if (["color", "background-color"].includes(source)) {
          value = brand.getColor(value as string);
        }
        typographyVariables.push(
          `$${target}: ${value} !default;`,
        );
      }
    }
  }

  typographyVariables.push(
    '// quarto-scss-analysis-annotation { "action": "pop" }',
  );
  return {
    defaults: typographyVariables.join("\n"),
    uses: Array.from(typographyImports).join("\n"),
    functions: "",
    mixins: "",
    rules: "",
  };
};

export async function brandSassLayers(
  fileName: string | undefined,
  project: ProjectContext,
  nameMap: Record<string, string> = {},
): Promise<SassLayer[]> {
  const brand = await project.resolveBrand(fileName);
  const sassLayers: SassLayer[] = [];

  if (brand) {
    sassLayers.push({
      defaults: '$theme: "brand" !default;',
      uses: "",
      functions: "",
      mixins: "",
      rules: "",
    });
  }
  if (brand?.data.color) {
    sassLayers.push(brandColorLayer(brand, nameMap));
  }

  if (brand?.data.typography) {
    sassLayers.push(brandTypographyLayer(brand));
  }

  return sassLayers;
}

export async function brandBootstrapSassLayers(
  fileName: string | undefined,
  project: ProjectContext,
  nameMap: Record<string, string> = {},
): Promise<SassLayer[]> {
  const layers = await brandSassLayers(
    fileName,
    project,
    nameMap,
  );

  const brand = await project.resolveBrand(fileName);
  if (brand?.data?.defaults?.bootstrap) {
    layers.unshift(brandDefaultsBootstrapLayer(brand));
  }

  return layers;
}

export async function brandRevealSassLayers(
  input: string | undefined,
  _format: Format,
  project: ProjectContext,
): Promise<SassLayer[]> {
  return brandSassLayers(
    input,
    project,
    defaultColorNameMap,
  );
}

export async function brandSassFormatExtras(
  input: string | undefined,
  _format: Format,
  project: ProjectContext,
): Promise<FormatExtras> {
  const htmlSassBundleLayers = await brandBootstrapSassLayers(
    input,
    project,
    defaultColorNameMap,
  );
  return {
    html: {
      [kSassBundles]: [
        {
          key: "brand",
          dependency: "bootstrap",
          user: htmlSassBundleLayers,
        },
      ],
    },
  };
}
