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
  SassBundleLayers,
} from "../../config/types.ts";
import { join, relative } from "../../deno_ral/path.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  BrandFont,
  BrandFontBunny,
  BrandFontGoogle,
  BrandFontWeight,
} from "../../resources/types/schema-types.ts";
import { Brand } from "../brand/brand.ts";

const defaultColorNameMap: Record<string, string> = {
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
  return (await brandBootstrapSassBundleLayers(
    fileName,
    project,
    key,
    defaultColorNameMap,
  )).map(
    (layer: SassBundleLayers) => {
      return {
        ...layer,
        dependency: "bootstrap",
      };
    },
  );
}

const fontFileFormat = (file: string): string => {
  const fragments = file.split(".");
  if (fragments.length < 2) {
    throw new Error(`Invalid font file ${file}; expected extension.`);
  }
  const ext = fragments.pop();
  // https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/src#font_formats
  switch (ext) {
    case "otc":
    case "ttc":
      return "collection";
    case "woff":
      return "woff";
    case "woff2":
      return "woff2";
    case "ttf":
      return "truetype";
    case "otf":
      return "opentype";
    case "svg":
    case "svgz":
      return "svg";
    case "eot":
      return "embedded-opentype";
    default:
      throw new Error(`Unknown font format ${ext} in ${file}`);
  }
};

const bunnyFontImportString = (description: BrandFontBunny) => {
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
  // }
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

const brandColorBundle = (
  brand: Brand,
  key: string,
  nameMap: Record<string, string>,
): SassBundleLayers => {
  const colorVariables: string[] = ["/* color variables from _brand.yml */"];
  for (const colorKey of Object.keys(brand.data?.color?.palette ?? {})) {
    colorVariables.push(
      `$${colorKey}: ${brand.getColor(colorKey)} !default;`,
    );
  }
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
  const colorBundle: SassBundleLayers = {
    key,
    // dependency: "bootstrap",
    quarto: {
      defaults: colorVariables.join("\n"),
      uses: "",
      functions: "",
      mixins: "",
      rules: "",
    },
  };
  return colorBundle;
};

const brandTypographyBundle = (
  brand: Brand,
  key: string,
): SassBundleLayers => {
  const typographyVariables: string[] = [
    "/* typography variables from _brand.yml */",
  ];
  const typographyImports: string[] = [];
  const fonts = brand.data?.typography?.fonts ?? [];

  const pathCorrection = relative(brand.projectDir, brand.brandDir);
  const computePath = (file: string) => {
    if (file.startsWith("http://") || file.startsWith("https://")) {
      return file;
    }
    // paths in our CSS are always relative to the project directory
    if (file.startsWith("/")) {
      return file.slice(1);
    }
    return join(pathCorrection, file);
  };

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
          `Inconsisent Google font families found: ${googleFamily} and ${thisFamily}`,
        );
      }
      typographyVariables.push(googleFontImportString(resolvedFont));
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
      // resolveBunnyFontFamily(font) ??
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

      // revealjs
      ["family", "mainFont"],
      ["size", "presentation-font-size-root"],
      ["line-height", "presentation-line-height"],
      // TBD?
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
    "monospace": [
      // bootstrap + revealjs
      ["family", "font-family-monospace"],
      // bootstrap
      ["size", "code-font-size"],
      // revealjs
      ["size", "code-block-font-size"],
    ],
    "monospace-block": [
      // bootstrap + revealjs
      ["family", "font-family-monospace-block"],
      // bootstrap
      ["line-height", "pre-line-height"],
      ["color", "pre-color"],
      ["background-color", "pre-bg"],
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
      // revealjs
      ["size", "code-block-font-size"],
    ],
  };

  for (
    const kind of [
      "base",
      "headings",
      "monospace",
      "monospace-block",
      "monospace-inline",
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
        typographyVariables.push(
          `$${target}: ${fontInformation[source]} !default;`,
        );
      }
    }
  }

  const typographyBundle: SassBundleLayers = {
    key,
    // dependency: "bootstrap",
    quarto: {
      defaults: typographyVariables.join("\n"),
      uses: typographyImports.join("\n"),
      functions: "",
      mixins: "",
      rules: "",
    },
  };
  return typographyBundle;
};

export async function brandBootstrapSassBundleLayers(
  fileName: string | undefined,
  project: ProjectContext,
  key: string,
  nameMap: Record<string, string> = {},
): Promise<SassBundleLayers[]> {
  const brand = await project.resolveBrand(fileName);
  const sassBundles: SassBundleLayers[] = [];

  if (brand?.data.color) {
    sassBundles.push(brandColorBundle(brand, key, nameMap));
  }

  if (brand?.data.typography) {
    sassBundles.push(brandTypographyBundle(brand, key));
  }

  return sassBundles;
}

export async function brandRevealSassBundleLayers(
  input: string | undefined,
  _format: Format,
  project: ProjectContext,
): Promise<SassBundleLayers[]> {
  return brandBootstrapSassBundleLayers(
    input,
    project,
    "reveal-theme",
    defaultColorNameMap,
  );
}

export async function brandSassFormatExtras(
  input: string | undefined,
  _format: Format,
  project: ProjectContext,
): Promise<FormatExtras> {
  const htmlSassBundleLayers = await brandBootstrapSassBundleLayers(
    input,
    project,
    "brand",
    defaultColorNameMap,
  );
  const htmlSassBundles: SassBundle[] = htmlSassBundleLayers.map((layer) => {
    return {
      ...layer,
      dependency: "bootstrap",
    };
  });
  if (htmlSassBundles.length === 0) {
    return {};
  } else {
    return {
      html: {
        [kSassBundles]: htmlSassBundles,
      },
    };
  }
}
