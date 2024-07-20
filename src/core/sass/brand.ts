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

export async function brandBootstrapSassBundles(
  project: ProjectContext,
  key: string,
): Promise<SassBundle[]> {
  return (await brandBootstrapSassBundleLayers(project, key)).map(
    (layer: SassBundleLayers) => {
      return {
        ...layer,
        dependency: "bootstrap",
      };
    },
  );
}
export async function brandBootstrapSassBundleLayers(
  project: ProjectContext,
  key: string,
): Promise<SassBundleLayers[]> {
  const brand = await project.resolveBrand();
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
  _format: Format,
  project: ProjectContext,
): Promise<SassBundleLayers[]> {
  return brandBootstrapSassBundleLayers(project, "reveal-theme");
}

export async function brandSassFormatExtras(
  _format: Format,
  project: ProjectContext,
): Promise<FormatExtras> {
  const htmlSassBundleLayers = await brandBootstrapSassBundleLayers(
    project,
    "brand",
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
