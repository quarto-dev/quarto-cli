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
