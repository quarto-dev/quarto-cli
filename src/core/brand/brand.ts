/*
 * brand.ts
 *
 * Class that implements support for `_brand.yml` data in Quarto
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import {
  BrandColorLightDark,
  BrandFont,
  BrandLogoExplicitResource,
  BrandNamedThemeColor,
  BrandSingle,
  BrandTypographyOptionsBase,
  BrandTypographyOptionsHeadingsSingle,
  BrandTypographySingle,
  BrandTypographyUnified,
  BrandUnified,
  Zod,
} from "../../resources/types/zod/schema-types.ts";
import { InternalError } from "../lib/error.ts";

import { join, relative } from "../../deno_ral/path.ts";
import { warnOnce } from "../log.ts";
import { isCssColorName } from "../css/color-names.ts";

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
  typography: BrandTypographySingle;
  logo: {
    small?: CanonicalLogoInfo;
    medium?: CanonicalLogoInfo;
    large?: CanonicalLogoInfo;
    images: Record<string, BrandLogoExplicitResource>;
  };
};

export class Brand {
  data: BrandSingle;
  brandDir: string;
  projectDir: string;
  processedData: ProcessedBrandData;

  constructor(
    readonly brand: unknown,
    brandDir: string,
    projectDir: string,
  ) {
    this.data = Zod.BrandSingle.parse(brand);
    this.brandDir = brandDir;
    this.projectDir = projectDir;
    this.processedData = this.processData(this.data);
  }

  processData(data: BrandSingle): ProcessedBrandData {
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

    const typography: BrandTypographySingle = {};
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
    }
    for (const [key, value] of Object.entries(data.logo?.images ?? {})) {
      if (typeof value === "string") {
        logo.images[key] = { path: value };
      } else {
        logo.images[key] = value;
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
  getColor(name: string, quiet = false): string {
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
        // if the name is not a default color name, assume it's a color value
        if (!isCssColorName(name) && !quiet) {
          warnOnce(
            `"${name}" is not a valid CSS color name.\nThis might cause SCSS compilation to fail, or the color to have no effect.`,
          );
        }
        return name;
      }
    } while (seenValues.size < 100); // 100 ought to be enough for anyone, with apologies to Bill Gates
    throw new Error(
      "Recursion depth exceeded 100 in _brand.yml color definitions",
    );
  }

  getFont(
    name: string,
  ):
    | BrandTypographyOptionsBase
    | BrandTypographyOptionsHeadingsSingle
    | undefined {
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
    return {
      ...entry,
      path: join(pathPrefix, entry.path),
    };
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

export type LightDarkBrand = {
  light?: Brand;
  dark?: Brand;
};

export type LightDarkColor = {
  light?: string;
  dark?: string;
};

export const getFavicon = (brand: Brand): string | undefined => {
  const logoInfo = brand.getLogo("small");
  if (!logoInfo) {
    return undefined;
  }
  return logoInfo.light.path;
};

function splitColorLightDark(
  bcld: BrandColorLightDark,
): LightDarkColor {
  if (typeof bcld === "string") {
    return { light: bcld, dark: bcld };
  }
  return bcld;
}
function colorIsUnified(blcd: BrandColorLightDark) {
  return typeof blcd === "object" && "dark" in blcd;
}
export function brandIsUnified(brand: BrandUnified): boolean {
  if (brand.color) {
    for (const colorName of Zod.BrandNamedThemeColor.options) {
      if (!brand.color[colorName]) {
        continue;
      }
      if (colorIsUnified(brand.color![colorName])) {
        return true;
      }
    }
  }
  if (brand.typography) {
    for (const elementName of Zod.BrandNamedTypographyElements.options) {
      const element = brand.typography![elementName];
      if (!element || typeof element === "string") {
        continue;
      }
      if (
        "background-color" in element && element["background-color"] &&
        colorIsUnified(element["background-color"])
      ) {
        return true;
      }
      if (
        "color" in element && element["color"] &&
        colorIsUnified(element["color"])
      ) {
        return true;
      }
    }
  }
  return false;
}
function sharedTypography(
  unified: BrandTypographyUnified,
): BrandTypographySingle {
  const ret: BrandTypographySingle = {
    fonts: unified.fonts,
  };
  for (const elementName of Zod.BrandNamedTypographyElements.options) {
    if (!unified[elementName]) {
      continue;
    }
    if (typeof unified[elementName] === "string") {
      ret[elementName] = unified[elementName];
      continue;
    }
    ret[elementName] = Object.fromEntries(
      Object.entries(unified[elementName]).filter(
        ([key, _]) => !["color", "background-color"].includes(key),
      ),
    );
  }
  return ret;
}
export function splitUnifiedBrand(
  unified: unknown,
  brandDir: string,
  projectDir: string,
): LightDarkBrand {
  const unifiedBrand: BrandUnified = Zod.BrandUnified.parse(unified);
  let typography: BrandTypographySingle | undefined = undefined;
  let headingsColor: LightDarkColor | undefined = undefined;
  let monospaceColor: LightDarkColor | undefined = undefined;
  let monospaceBackgroundColor: LightDarkColor | undefined = undefined;
  let monospaceInlineColor: LightDarkColor | undefined = undefined;
  let monospaceInlineBackgroundColor: LightDarkColor | undefined = undefined;
  let monospaceBlockColor: LightDarkColor | undefined = undefined;
  let monospaceBlockBackgroundColor: LightDarkColor | undefined = undefined;
  let linkColor: LightDarkColor | undefined = undefined;
  let linkBackgroundColor: LightDarkColor | undefined = undefined;
  if (unifiedBrand.typography) {
    typography = sharedTypography(unifiedBrand.typography);
    if (
      unifiedBrand.typography.headings &&
      typeof unifiedBrand.typography.headings !== "string" &&
      unifiedBrand.typography.headings.color
    ) {
      headingsColor = splitColorLightDark(
        unifiedBrand.typography.headings.color,
      );
    }
    if (
      unifiedBrand.typography.monospace &&
      typeof unifiedBrand.typography.monospace !== "string"
    ) {
      if (unifiedBrand.typography.monospace.color) {
        monospaceColor = splitColorLightDark(
          unifiedBrand.typography.monospace.color,
        );
      }
      if (unifiedBrand.typography.monospace["background-color"]) {
        monospaceBackgroundColor = splitColorLightDark(
          unifiedBrand.typography.monospace["background-color"],
        );
      }
    }
    if (
      unifiedBrand.typography["monospace-inline"] &&
      typeof unifiedBrand.typography["monospace-inline"] !== "string"
    ) {
      if (unifiedBrand.typography["monospace-inline"].color) {
        monospaceInlineColor = splitColorLightDark(
          unifiedBrand.typography["monospace-inline"].color,
        );
      }
      if (unifiedBrand.typography["monospace-inline"]["background-color"]) {
        monospaceInlineBackgroundColor = splitColorLightDark(
          unifiedBrand.typography["monospace-inline"]["background-color"],
        );
      }
    }
    if (
      unifiedBrand.typography["monospace-block"] &&
      typeof unifiedBrand.typography["monospace-block"] !== "string"
    ) {
      if (unifiedBrand.typography["monospace-block"].color) {
        monospaceBlockColor = splitColorLightDark(
          unifiedBrand.typography["monospace-block"].color,
        );
      }
      if (unifiedBrand.typography["monospace-block"]["background-color"]) {
        monospaceBlockBackgroundColor = splitColorLightDark(
          unifiedBrand.typography["monospace-block"]["background-color"],
        );
      }
    }
    if (
      unifiedBrand.typography.link &&
      typeof unifiedBrand.typography.link !== "string"
    ) {
      if (unifiedBrand.typography.link.color) {
        linkColor = splitColorLightDark(
          unifiedBrand.typography.link.color,
        );
      }
      if (unifiedBrand.typography.link["background-color"]) {
        linkBackgroundColor = splitColorLightDark(
          unifiedBrand.typography.link["background-color"],
        );
      }
    }
  }
  const specializeTypography = (
    typography: BrandTypographySingle,
    mode: "light" | "dark",
  ) =>
    typography && {
      fonts: typography.fonts && [...typography.fonts],
      base: !typography.base || typeof typography.base === "string"
        ? typography.base
        : { ...typography.base },
      headings: !typography.headings || typeof typography.headings === "string"
        ? typography.headings
        : {
          ...typography.headings,
          color: headingsColor && headingsColor[mode],
        },
      monospace:
        !typography.monospace || typeof typography.monospace === "string"
          ? typography.monospace
          : {
            ...typography.monospace,
            color: monospaceColor && monospaceColor[mode],
            "background-color": monospaceBackgroundColor &&
              monospaceBackgroundColor[mode],
          },
      "monospace-inline": !typography["monospace-inline"] ||
          typeof typography["monospace-inline"] === "string"
        ? typography["monospace-inline"]
        : {
          ...typography["monospace-inline"],
          color: monospaceInlineColor && monospaceInlineColor[mode],
          "background-color": monospaceInlineBackgroundColor &&
            monospaceInlineBackgroundColor[mode],
        },
      "monospace-block": !typography["monospace-block"] ||
          typeof typography["monospace-block"] === "string"
        ? typography["monospace-block"]
        : {
          ...typography["monospace-block"],
          color: monospaceBlockColor && monospaceBlockColor[mode],
          "background-color": monospaceBlockBackgroundColor &&
            monospaceBlockBackgroundColor[mode],
        },
      link: !typography.link || typeof typography.link === "string"
        ? typography.link
        : {
          ...typography.link,
          color: linkColor && linkColor[mode],
          "background-color": linkBackgroundColor &&
            linkBackgroundColor[mode],
        },
    };
  const lightBrand: BrandSingle = {
    meta: unifiedBrand.meta,
    color: { palette: unifiedBrand.color && { ...unifiedBrand.color.palette } },
    typography: typography && specializeTypography(typography, "light"),
    logo: unifiedBrand.logo,
    defaults: unifiedBrand.defaults,
  };
  const darkBrand: BrandSingle = {
    meta: unifiedBrand.meta,
    color: { palette: unifiedBrand.color && { ...unifiedBrand.color.palette } },
    typography: typography && specializeTypography(typography, "dark"),
    logo: unifiedBrand.logo,
    defaults: unifiedBrand.defaults,
  };
  if (unifiedBrand.color) {
    for (const colorName of Zod.BrandNamedThemeColor.options) {
      if (!unifiedBrand.color[colorName]) {
        continue;
      }
      ({
        light: lightBrand.color![colorName],
        dark: darkBrand.color![colorName],
      } = splitColorLightDark(unifiedBrand.color![colorName]));
    }
  }
  return {
    light: new Brand(lightBrand, brandDir, projectDir),
    dark: brandIsUnified(unifiedBrand)
      ? new Brand(darkBrand, brandDir, projectDir)
      : undefined,
  };
}
