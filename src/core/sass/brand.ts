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
import { BrandFontGoogle } from "../../resources/types/schema-types.ts";

const defaultColorNameMap: Record<string, string> = {
  "body-bg": "background",
  "body-color": "foreground",
  "body-secondary-color": "secondary",
  "body-secondary": "secondary",
  "body-tertiary-color": "tertiary",
  "body-tertiary": "secondary",
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

  if (brand?.processedData.typography) {
    const typographyVariables: string[] = [
      "/* typography variables from _brand.yml */",
    ];
    const typographyImports: string[] = [];

    if (brand?.data.typography?.base) {
      const family = brand.data.typography.base.family;
      const tWith = brand.data.typography.with;
      if (!tWith || !family || !tWith[family]) {
        throw new Error(
          `Typography base font ${family} description not found in _brand.yml`,
        );
      }
      if (!(tWith[family] as any).google) {
        console.log(
          `Only Google fonts are supported in SCSS for now. Skipping base font ${family}`,
        );
      } else {
        const description = (tWith[family] as BrandFontGoogle).google;
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
          const styles = !description.style
            ? ["normal", "italic"]
            : typeof description.style === "string"
            ? [description.style]
            : description.style;
          const weightArray = !description.weight
            ? [400, 700]
            : typeof description.weight === "number"
            ? [description.weight]
            : description.weight;
          let styleString = "";
          let weights = "";

          if (styles.includes("italic")) {
            styleString = "ital,";
            weights = weightArray.map((w) => `0,${w}`).join(";") +
              ";" +
              weightArray.map((w) => `1,${w}`).join(";");
          } else {
            weights = !description.weight
              ? "400;700"
              : typeof description.weight === "number"
              ? String(description.weight)
              : description.weight.join(";");
          }
          const display = description.display ?? "swap";

          const googleFamily = description.family;
          if (!googleFamily) {
            throw new Error(
              `Font description requires base font ${family} family information not found in _brand.yml`,
            );
          }

          typographyImports.push(
            `@import url('https://fonts.googleapis.com/css2?family=${
              googleFamily!.replace(
                / /g,
                "+",
              )
            }:${styleString}wght@${weights}&display=${display}');`,
          );
          typographyVariables.push(
            `$font-family-base: ${googleFamily} !default;`,
          );
          // hack: we add both reveal and bootstrap font names
          typographyVariables.push(
            `$mainFont: ${googleFamily} !default;`,
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
