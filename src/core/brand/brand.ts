/*
 * brand.ts
 *
 * Class that implements support for `_brand.yml` data in Quarto
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import {
  Brand as BrandJson,
  BrandFont,
  BrandNamedLogo,
  BrandNamedThemeColor,
  BrandStringLightDark,
  BrandTypography,
  BrandTypographyOptions,
} from "../../resources/types/schema-types.ts";

// we can't programmatically convert typescript types to string arrays,
// so we have to define this manually. They should match `BrandNamedThemeColor` in schema-types.ts

export const defaultColorNames: BrandNamedThemeColor[] = [
  "foreground",
  "background",
  "primary",
  "secondary",
  "tertiary",
  "success",
  "info",
  "warning",
  "danger",
  "light",
  "dark",
  "emphasis",
  "link",
];

const defaultLogoNames: string[] = [
  "small",
  "medium",
  "large",
];

type ProcessedBrandData = {
  color: Record<string, string>;
  typography: BrandTypography;
  logo: Record<string, BrandStringLightDark>;
};

export class Brand {
  data: BrandJson;
  brandDir: string;
  projectDir: string;
  processedData: ProcessedBrandData;

  constructor(readonly brand: BrandJson, brandDir: string, projectDir: string) {
    this.data = brand;
    this.brandDir = brandDir;
    this.projectDir = projectDir;
    this.processedData = this.processData(brand);
  }

  processData(data: BrandJson): ProcessedBrandData {
    const color: Record<string, string> = {};
    for (const colorName of Object.keys(data.color?.palette ?? {})) {
      color[colorName] = this.getColor(colorName);
    }
    for (const colorName of Object.keys(data.color ?? {})) {
      if (colorName === "palette") {
        continue;
      }
      color[colorName] = this.getColor(colorName);
    }

    const typography: BrandTypography = {};
    const base = this.getFont("base");
    if (base) {
      typography.base = base;
    }
    const headings = this.getFont("headings");
    if (headings) {
      typography.headings = headings;
    }
    const link = data.typography?.link;
    if (link) {
      typography.link = link;
    }
    const monospace = this.getFont("monospace");
    if (monospace) {
      typography.monospace = monospace;
    }
    const monospaceInline = this.getFont("monospace-inline");
    if (monospace || monospaceInline) {
      typography["monospace-inline"] = {
        ...(monospace ?? {}),
        ...(monospaceInline ?? {}),
      };
    }
    const monospaceBlock = this.getFont("monospace-block");
    if (monospace || monospaceBlock) {
      typography["monospace-block"] = {
        ...(monospace ?? {}),
        ...(monospaceBlock ?? {}),
      };
    }

    const logo: Record<string, BrandStringLightDark> = {};
    for (const logoName of Object.keys(data.logo?.images ?? {})) {
      logo[logoName] = this.getLogo(logoName);
    }
    for (const logoName of Object.keys(data.logo ?? {})) {
      if (logoName === "images") {
        continue;
      }
      logo[logoName] = this.getLogo(logoName);
    }

    return {
      color,
      typography,
      logo,
    };
  }

  // semantics of name resolution for colors:
  // - if the name is in the "palette" key, use that value as they key for a recursive call (so color names can be aliased or redefined away from scss defaults)
  // - if the name is a default color name, call getColor recursively (so defaults can use named values)
  // - otherwise, assume it's a color value and return it
  getColor(name: string): string {
    const seenValues = new Set<string>();

    do {
      if (seenValues.has(name)) {
        throw new Error(
          `Circular reference in _brand.yml color definitions: ${
            Array.from(seenValues).join(
              " -> ",
            )
          }`,
        );
      }
      seenValues.add(name);
      if (this.data.color?.palette?.[name]) {
        name = this.data.color.palette[name] as string;
      } else if (
        defaultColorNames.includes(name as BrandNamedThemeColor) &&
        this.data.color?.[name as BrandNamedThemeColor]
      ) {
        name = this.data.color[name as BrandNamedThemeColor]!;
      } else {
        return name;
      }
    } while (seenValues.size < 100); // 100 ought to be enough for anyone, with apologies to Bill Gates
    throw new Error(
      "Recursion depth exceeded 100 in _brand.yml color definitions",
    );
  }

  getFont(name: string): BrandTypographyOptions | undefined {
    if (!this.data.typography) {
      return undefined;
    }
    const typography = this.data.typography;
    switch (name) {
      case "base":
        return typography.base;
      case "headings":
        return typography.headings;
      case "link":
        return typography.link;
      case "monospace":
        return typography.monospace;
      case "monospace-inline":
        return typography["monospace-inline"];
      case "monospace-block":
        return typography["monospace-block"];
    }
    return undefined;
  }

  getFontResources(name: string): BrandFont[] {
    if (name === "fonts") {
      throw new Error(
        "'fonts' is a reserved name in _brand.yml typography definitions",
      );
    }
    if (!this.data.typography) {
      return [];
    }
    const typography = this.data.typography;
    const fonts = typography.fonts;
    return fonts ?? [];
  }

  // the same implementation as getColor except we can also return {light,dark}
  // assuming for now that with only contains strings, not {light,dark}
  getLogo(name: string): BrandStringLightDark {
    const seenValues = new Set<string>();
    do {
      if (seenValues.has(name)) {
        throw new Error(
          `Circular reference in _brand.yml color definitions: ${
            Array.from(seenValues).join(
              " -> ",
            )
          }`,
        );
      }
      seenValues.add(name);
      if (this.data.logo?.images?.[name]) {
        name = this.data.logo.images[name] as string;
      } else if (
        defaultLogoNames.includes(name as BrandNamedLogo) &&
        this.data.logo?.[name as BrandNamedLogo]
      ) {
        const brandSLD: BrandStringLightDark = this.data
          .logo[name as BrandNamedLogo]!;
        if (typeof brandSLD == "string") {
          name = brandSLD;
        } else {
          const ret: BrandStringLightDark = {};
          // we need to actually-recurse and not just use the loop
          // because two paths light/dark
          const light = brandSLD.light;
          if (light) {
            const brandSLD2 = this.getLogo(light);
            if (typeof brandSLD2 == "string") {
              ret.light = brandSLD2;
            } else {
              ret.light = brandSLD2.light;
            }
          }
          const dark = brandSLD.dark;
          if (dark) {
            const brandSLD2 = this.getLogo(dark);
            if (typeof brandSLD2 == "string") {
              ret.dark = brandSLD2;
            } else {
              ret.dark = brandSLD2.light;
            }
          }
          return ret;
        }
      } else {
        return name;
      }
    } while (seenValues.size < 100); // 100 ought to be enough for anyone, with apologies to Bill Gates
    throw new Error(
      "Recursion depth exceeded 100 in _brand.yml logo definitions",
    );
  }
}
