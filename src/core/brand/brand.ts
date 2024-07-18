/*
 * brand.ts
 *
 * Class that implements support for `_brand.yml` data in Quarto
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import {
  Brand as BrandJson,
  BrandNamedThemeColor,
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

// const defaultFontNames: string[] = [
//   "base",
//   "emphasis",
//   "heading",
//   "link",
//   "monospace",
// ];

export class Brand {
  data: BrandJson;

  constructor(readonly brand: BrandJson) {
    this.data = brand;
  }

  // semantics of name resolution for colors, logo and fonts are:
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
}
