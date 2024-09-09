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
import { ProjectContext } from "../../project/types.ts";
import {
  BrandFont,
  BrandFontBunny,
  BrandFontGoogle,
  BrandFontWeight,
  BrandTypographyOptions,
} from "../../resources/types/schema-types.ts";

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

const bunnyFontImportString = (description: BrandFontBunny["bunny"]) => {
  const bunnyName = (name: string) => name.replace(/ /g, "-");
  if (typeof description === "string") {
    return `@import url('https://fonts.bunny.net/css?family=${
      bunnyName(description)
    }:400,700');`;
  } else {
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
    }:${weights}');`;
  }
};

const googleFontImportString = (description: BrandFontGoogle["google"]) => {
  if (typeof description === "string") {
    return `@import url('https://fonts.googleapis.com/css2?family=${
      description.replace(
        / /g,
        "+",
      )
    }:ital,wght@400;700&display=swap');`;
  } else {
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
  }
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
    const colorVariables: string[] = ["/* color variables from _brand.yml */"];
    for (const colorKey of Object.keys(brand.data.color.with ?? {})) {
      colorVariables.push(
        `$${colorKey}: ${brand.getColor(colorKey)} !default;`,
      );
    }
    for (const colorKey of Object.keys(brand.data.color)) {
      if (colorKey === "with") {
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
    sassBundles.push(colorBundle);
  }

  if (brand?.data.typography) {
    const typographyVariables: string[] = [
      "/* typography variables from _brand.yml */",
    ];
    const typographyImports: string[] = [];
    const tWith = brand.data.typography.with;

    const getFontFamily = (family: string | undefined) => {
      if (!tWith || !family || !tWith[family]) {
        throw new Error(
          `Typography family ${family} description not found in _brand.yml`,
        );
      }
      return tWith[family];
    };

    const resolveGoogleFontFamily = (
      font: BrandFont,
    ): string | undefined => {
      const description = (font as BrandFontGoogle).google;
      if (!description) {
        return undefined;
      }
      const googleFamily = typeof description === "string"
        ? description
        : description.family;
      if (!googleFamily) {
        return undefined;
      }
      typographyVariables.push(googleFontImportString(description));
      return googleFamily;
    };

    const resolveBunnyFontFamily = (
      font: BrandFont,
    ): string | undefined => {
      const description = (font as BrandFontBunny).bunny;
      if (!description) {
        return undefined;
      }
      const bunnyFamily = typeof description === "string"
        ? description
        : description.family;
      if (!bunnyFamily) {
        return undefined;
      }
      typographyVariables.push(bunnyFontImportString(description));
      return bunnyFamily;
    };

    type HTMLFontInformation = { [key: string]: unknown };

    const resolveHTMLFontInformation = (
      kind: "base" | "headings" | "monospace",
    ): HTMLFontInformation | undefined => {
      const resolvedFontOptions = brand.data.typography?.[kind];
      if (!resolvedFontOptions) {
        return undefined;
      }
      const family = resolvedFontOptions.family;
      const font = getFontFamily(family);
      const result: HTMLFontInformation = {};

      result.family = resolveGoogleFontFamily(font) ??
        resolveBunnyFontFamily(font);
      result.lineHeight = resolvedFontOptions["line-height"];
      if ((resolvedFontOptions as any).size) {
        result[kind + "-size"] = (resolvedFontOptions as any).size;
      }
      return result;
    };

    // see
    // https://github.com/posit-dev/brand-yml/issues/15: line-height in code
    // https://github.com/posit-dev/brand-yml/issues/16: where should color be?

    const variableTranslations: Record<string, [string, string][]> = {
      "base": [
        ["family", "font-family-base"], // bootstrap
        ["family", "mainFont"], // revealjs
        ["base-size", "font-size-base"], // bootstrap
        ["base-size", "presentation-font-size-root"], // revealjs
        ["lineHeight", "line-height-base"],
        ["lineHeight", "presentation-line-height"],
      ],
      "headings": [
        ["family", "headings-font-family"], // bootstrap
        ["family", "presentation-heading-font"], // revealjs
        ["lineHeight", "headings-line-height"], // bootstrap
        ["lineHeight", "presentation-heading-line-height"], // revealjs
      ],
      "monospace": [
        ["family", "font-family-monospace"], // bootstrap + revealjs
        ["monospace-size", "code-font-size"], // bootstrap
        ["monospace-size", "code-block-font-size"], // revealjs
      ],
    };

    for (const kind of ["base", "headings", "monospace"]) {
      const fontInformation = resolveHTMLFontInformation(
        kind as "base" | "headings" | "monospace",
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
    sassBundles.push(typographyBundle);
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
