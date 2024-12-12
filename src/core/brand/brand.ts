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
  BrandLogoExplicitResource,
  BrandNamedThemeColor,
  BrandTypography,
  BrandTypographyOptionsBase,
  BrandTypographyOptionsHeadings,
} from "../../resources/types/schema-types.ts";
import { InternalError } from "../lib/error.ts";

import { join, relative } from "../../deno_ral/path.ts";

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
  "link",
];

const defaultLogoNames: string[] = [
  "small",
  "medium",
  "large",
];

type CanonicalLogoInfo = {
  light: BrandLogoExplicitResource;
  dark: BrandLogoExplicitResource;
};

type ProcessedBrandData = {
  color: Record<string, string>;
  typography: BrandTypography;
  logo: {
    small?: CanonicalLogoInfo;
    medium?: CanonicalLogoInfo;
    large?: CanonicalLogoInfo;
    images: Record<string, BrandLogoExplicitResource>;
  };
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
    let monospace = this.getFont("monospace");
    let monospaceInline = this.getFont("monospace-inline");
    let monospaceBlock = this.getFont("monospace-block");

    if (monospace) {
      if (typeof monospace === "string") {
        monospace = { family: monospace };
      }
      typography.monospace = monospace;
    }
    if (monospaceInline && typeof monospaceInline === "string") {
      monospaceInline = { family: monospaceInline };
    }
    if (monospaceBlock && typeof monospaceBlock === "string") {
      monospaceBlock = { family: monospaceBlock };
    }

    // cut off control flow here so the type checker knows these
    // are not strings
    if (typeof monospace === "string") {
      throw new InternalError("should never happen");
    }
    if (typeof monospaceInline === "string") {
      throw new InternalError("should never happen");
    }
    if (typeof monospaceBlock === "string") {
      throw new InternalError("should never happen");
    }

    if (monospace || monospaceInline) {
      typography["monospace-inline"] = {
        ...(monospace ?? {}),
        ...(monospaceInline ?? {}),
      };
    }
    if (monospaceBlock) {
      if (typeof monospaceBlock === "string") {
        monospaceBlock = { family: monospaceBlock };
      }
    }
    if (monospace || monospaceBlock) {
      typography["monospace-block"] = {
        ...(monospace ?? {}),
        ...(monospaceBlock ?? {}),
      };
    }

    const logo: ProcessedBrandData["logo"] = { images: {} };
    for (
      const size of [
        "small",
        "medium",
        "large",
      ] as ("small" | "medium" | "large")[]
    ) {
      const v = this.getLogo(size);
      if (v) {
        logo[size] = v;
      }
      for (const [key, value] of Object.entries(data.logo?.images ?? {})) {
        if (typeof value === "string") {
          logo.images[key] = { path: value };
        } else {
          logo.images[key] = value;
        }
      }
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

  getFont(
    name: string,
  ): BrandTypographyOptionsBase | BrandTypographyOptionsHeadings | undefined {
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

  getLogoResource(name: string): BrandLogoExplicitResource {
    const entry = this.data.logo?.images?.[name];
    if (!entry) {
      return { path: name };
    }
    const pathPrefix = relative(this.projectDir, this.brandDir);
    if (typeof entry === "string") {
      return { path: join(pathPrefix, entry) };
    }
    entry.path = join(pathPrefix, entry.path);
    return entry;
  }

  getLogo(name: "small" | "medium" | "large"): CanonicalLogoInfo | undefined {
    const entry = this.data.logo?.[name];
    if (!entry) {
      return undefined;
    }
    if (typeof entry === "string") {
      const res = this.getLogoResource(entry);
      return {
        light: res,
        dark: res,
      };
    }
    const lightEntry = entry?.light
      ? this.getLogoResource(entry.light)
      : undefined;
    const darkEntry = entry?.dark
      ? this.getLogoResource(entry.dark)
      : undefined;
    if (lightEntry && darkEntry) {
      return {
        light: lightEntry,
        dark: darkEntry,
      };
    }
  }
}
