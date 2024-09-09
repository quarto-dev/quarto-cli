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
  BrandFontGoogle,
  BrandFontWeight,
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

    const addGoogleFontImport = (description: BrandFontGoogle["google"]) => {
      if (typeof description === "string") {
        typographyImports.push(
          `@import url('https://fonts.googleapis.com/css2?family=${
            description.replace(
              / /g,
              "+",
            )
          }:ital,wght@400;700&display=swap');`,
        );
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
        const display = description.display ?? "swap";
        typographyImports.push(
          `@import url('https://fonts.googleapis.com/css2?family=${
            googleFamily!.replace(
              / /g,
              "+",
            )
          }:${styleString}wght@${weights}&display=${display}');`,
        );
      }
    };

    const resolveGoogleFontFamily = (
      font: BrandFont,
      kind: string,
    ): string | undefined => {
      const description = (font as BrandFontGoogle).google;
      const googleFamily = typeof description === "string"
        ? description
        : description.family;
      if (!googleFamily) {
        console.log(
          `Only Google fonts are supported in SCSS for now. Skipping ${kind} font.`,
        );
        return undefined;
      }
      addGoogleFontImport(description);
      return googleFamily;
    };

    if (brand?.data.typography?.base) {
      const family = brand.data.typography.base.family;
      const fontFamily = getFontFamily(family);
      const googleFamily = resolveGoogleFontFamily(fontFamily, "base");

      if (googleFamily) {
        typographyVariables.push(
          `$font-family-base: ${googleFamily} !default;`,
        );
        // hack: we add both reveal and bootstrap font names
        typographyVariables.push(
          `$mainFont: ${googleFamily} !default;`,
        );
      }
    }

    if (brand?.data.typography?.headings) {
      const family = brand.data.typography.headings.family;
      const fontFamily = getFontFamily(family);
      const googleFamily = resolveGoogleFontFamily(fontFamily, "headings");
      if (googleFamily) {
        typographyVariables.push(
          `$headings-font-family: ${googleFamily} !default;`,
        );
        // TODO: revealjs
      }
    }

    if (brand?.data.typography?.monospace) {
      const family = brand.data.typography.monospace.family;
      const fontFamily = getFontFamily(family);
      const googleFamily = resolveGoogleFontFamily(fontFamily, "monospace");
      if (googleFamily) {
        // bootstrap and revealjs use the same variable
        typographyVariables.push(
          `$font-family-monospace: ${googleFamily} !default;`,
        );
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
