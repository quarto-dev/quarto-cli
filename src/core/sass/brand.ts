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
} from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";

export async function brandSassFormatExtras(
  _format: Format,
  project: ProjectContext,
): Promise<FormatExtras> {
  const brand = await project.resolveBrand();
  if (!brand) {
    return {};
  }
  const sassBundles: SassBundle[] = [];

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
    const colorBundle: SassBundle = {
      key: "brand-color",
      dependency: "bootstrap",
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

  return {
    html: {
      [kSassBundles]: sassBundles,
    },
  };
}
