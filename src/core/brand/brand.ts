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
  BrandFontStyle,
  BrandFontWeight,
  BrandNamedFont,
  BrandNamedThemeColor,
  BrandTypography,
  BrandTypographyOptions,
} from "../../resources/types/schema-types.ts";

import { mergeConfigs } from "../../core/config.ts";

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

// emphasis and link do not have font-family key
// could they still refer to with items?
const defaultFontNames: string[] = [
  "base",
  // "emphasis",
  "headings",
  // "link",
  "monospace",
];

type ProcessedBrandData = {
  color: Record<string, string>;
  typography: BrandTypography;
  // logo: Record<string, string>; // paths
};

export class Brand {
  data: BrandJson;
  processedData: ProcessedBrandData;

  constructor(readonly brand: BrandJson) {
    this.data = brand;
    this.processedData = this.processData(brand);
  }

  processData(data: BrandJson): ProcessedBrandData {
    const color: Record<string, string> = {};
    for (const colorName of Object.keys(data.color?.with ?? {})) {
      color[colorName] = this.getColor(colorName);
    }
    for (const colorName of Object.keys(data.color ?? {})) {
      if (colorName === "with") {
        continue;
      }
      color[colorName] = this.getColor(colorName);
    }

    const typography: BrandTypography = {};
    const base = this.getFont("base");
    if (base) {
      typography.base = base;
    }
    const emphasis = data.typography?.emphasis;
    if (emphasis) {
      typography.emphasis = emphasis;
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

    return {
      color,
      typography,
      // (o,
    };
  }

  // semantics of name resolution for colors, (o and fonts are:
  // - if the name is in the "with" key, use that value as they key for a recursive call (so color names can be aliased or redefined away from scss defaults)
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
      if (this.data.color?.with?.[name]) {
        name = this.data.color.with[name];
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

  getFont(name: string): BrandTypographyOptions | null {
    const seenValues = new Set<string>();
    const defs = new Array<BrandTypographyOptions>();

    if (!this.data.typography) {
      // alternatively we could provide defaults here
      return null;
    }

    // the family field is the key to recurse, finding objects to mergeConfig
    // eventually it resolves to an actual font family name which is kept
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
      const withFonts = this.data.typography.with as Record<string, BrandFont>;
      if (withFonts[name]) {
        const value = withFonts[name];
        if (typeof value == "string") {
          name = value;
        } else if ("files" in value) {
          if (!value.family) {
            console.warn("font needs family as key", value);
            return null;
          }
          name = value.family;
          const value2: BrandTypographyOptions = {
            files: value.files,
          };
          if (typeof (value.weight) == "number") {
            value2.weight = value.weight;
          } else if (Array.isArray(value.weight) && value.weight.length) {
            value2.weight = value.weight[0];
          }
          if (typeof (value.style) == "string") {
            value2.style = value.style;
          } else if (Array.isArray(value.style) && value.style.length) {
            value2.style = value.style[0];
          }
          defs.push(value2);
        } else {
          console.assert("google" in value);
          console.log("warning: google font forge not supported yet");
          // download to (temporary?) directory and populate .files
        }
      } else if (defaultFontNames.includes(name)) {
        const value = this.data.typography[name as BrandNamedFont];
        if (!value) {
          // alternatively we could provide defaults here
          return null;
        }
        if (typeof value == "string") {
          name = value;
        } else {
          if (!value.family) {
            console.warn("font needs family as key", value);
            return null;
          }
          name = value.family;
          const value2 = { ...value };
          delete value2.family;
          defs.push(value2);
        }
      } else {
        const ret = mergeConfigs({ family: name }, ...defs.reverse());
        return ret;
      }
    } while (seenValues.size < 100);
    throw new Error(
      "Recursion depth exceeded 100 in _brand.yml typography definitions",
    );
  }
}
