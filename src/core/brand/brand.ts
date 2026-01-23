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
  BrandLogoResource,
  BrandLogoSingle,
  BrandLogoUnified,
  BrandNamedLogo,
  BrandNamedThemeColor,
  BrandSingle,
  BrandStringLightDark,
  BrandTypographyOptionsBase,
  BrandTypographyOptionsHeadingsSingle,
  BrandTypographySingle,
  BrandTypographyUnified,
  BrandUnified,
  LogoLightDarkSpecifier,
  LogoOptions,
  NormalizedLogoLightDarkSpecifier,
  Zod,
} from "../../resources/types/zod/schema-types.ts";
import { InternalError } from "../lib/error.ts";

import { dirname, join, relative, resolve } from "../../deno_ral/path.ts";
import { warnOnce } from "../log.ts";
import { isCssColorName } from "../css/color-names.ts";
import { isExternalPath } from "../url.ts";
import {
  LogoLightDarkSpecifierPathOptional,
  LogoOptionsPathOptional,
  LogoSpecifier,
  LogoSpecifierPathOptional,
} from "../../resources/types/schema-types.ts";
import { ensureLeadingSlash } from "../path.ts";

type ProcessedBrandData = {
  color: Record<string, string>;
  typography: BrandTypographySingle;
  logo: {
    small?: BrandLogoExplicitResource;
    medium?: BrandLogoExplicitResource;
    large?: BrandLogoExplicitResource;
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
      const size of Zod.BrandNamedLogo.options
    ) {
      const v = this.getLogo(size);
      if (v) {
        logo[size] = v;
      }
    }
    for (const [key, value] of Object.entries(data.logo?.images ?? {})) {
      logo.images[key] = this.resolvePath(value);
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
        Zod.BrandNamedThemeColor.options.includes(
          name as BrandNamedThemeColor,
        ) &&
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

  resolvePath(entry: BrandLogoResource) {
    const pathPrefix = relative(this.projectDir, this.brandDir);
    if (typeof entry === "string") {
      return { path: isExternalPath(entry) ? entry : join(pathPrefix, entry) };
    }
    return {
      ...entry,
      path: isExternalPath(entry.path)
        ? entry.path
        : join(pathPrefix, entry.path),
    };
  }

  getLogoResource(name: string): BrandLogoExplicitResource {
    const entry = this.data.logo?.images?.[name];
    if (!entry) {
      return this.resolvePath(name);
    }
    return this.resolvePath(entry);
  }
  getLogo(name: BrandNamedLogo): BrandLogoExplicitResource | undefined {
    const entry = this.data.logo?.[name];
    if (!entry) {
      return undefined;
    }
    return this.getLogoResource(entry);
  }
}

export type LightDarkBrand = {
  light?: Brand;
  dark?: Brand;
};

export type LightDarkBrandDarkFlag = {
  light?: Brand;
  dark?: Brand;
  enablesDarkMode: boolean;
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
  return logoInfo.path;
};

export function resolveLogo(
  brand: LightDarkBrand | undefined,
  spec: LogoLightDarkSpecifier | undefined,
  order: BrandNamedLogo[],
): NormalizedLogoLightDarkSpecifier | undefined {
  const resolveBrandLogo = (
    mode: "light" | "dark",
    name: string,
  ): LogoOptions => {
    const logo = brand?.[mode]?.processedData?.logo;
    return logo &&
        ((Zod.BrandNamedLogo.options.includes(name as BrandNamedLogo) &&
          logo[name as BrandNamedLogo]) || logo.images[name]) ||
      { path: name };
  };
  function findLogo(
    mode: "light" | "dark",
    order: BrandNamedLogo[],
  ): LogoOptions | undefined {
    if (brand?.[mode]) {
      for (const size of order) {
        const logo = brand[mode].processedData.logo[size];
        if (logo) {
          return logo;
        }
      }
    }
    return undefined;
  }
  const resolveLogoOptions = (
    mode: "light" | "dark",
    logo: LogoOptions,
  ): LogoOptions => {
    const logo2 = resolveBrandLogo(mode, logo.path);
    if (logo2) {
      const { path: _, ...rest } = logo;
      return {
        ...logo2,
        ...rest,
      };
    }
    return logo;
  };
  if (spec === false) {
    return undefined;
  }
  if (!spec) {
    const lightLogo = findLogo("light", order);
    const darkLogo = findLogo("dark", order);
    if (!lightLogo && !darkLogo) {
      return undefined;
    }
    return {
      light: lightLogo || darkLogo,
      dark: darkLogo || lightLogo,
    };
  }
  if (typeof spec === "string") {
    return {
      light: resolveBrandLogo("light", spec),
      dark: resolveBrandLogo("light", spec),
    };
  }
  if ("path" in spec) {
    return {
      light: resolveLogoOptions("light", spec),
      dark: resolveLogoOptions("dark", spec),
    };
  }
  let light, dark;
  if (!spec.light) {
    light = findLogo("light", order);
  } else if (typeof spec.light === "string") {
    light = resolveBrandLogo("light", spec.light);
  } else {
    light = resolveLogoOptions("light", spec.light);
  }
  if (!spec.dark) {
    dark = findLogo("dark", order);
  } else if (typeof spec.dark === "string") {
    dark = resolveBrandLogo("dark", spec.dark);
  } else {
    dark = resolveLogoOptions("dark", spec.dark);
  }
  // light logo default to dark logo if no light logo specified
  if (!light && dark) {
    light = { ...dark };
  }
  // dark logo default to light logo if no dark logo specified
  // and dark mode is enabled
  if (!dark && light && brand && brand.dark) {
    dark = { ...light };
  }
  return {
    light,
    dark,
  };
}

const ensureLeadingSlashIfNotExternal = (path: string) =>
  isExternalPath(path) ? path : ensureLeadingSlash(path);

export function logoAddLeadingSlashes(
  spec: NormalizedLogoLightDarkSpecifier | undefined,
  brand: LightDarkBrand | undefined,
  input: string | undefined,
): NormalizedLogoLightDarkSpecifier | undefined {
  if (!spec) {
    return spec;
  }
  if (input) {
    const inputDir = dirname(resolve(input));
    if (!brand || inputDir === brand.light?.projectDir) {
      return spec;
    }
  }
  return {
    light: spec.light && {
      ...spec.light,
      path: ensureLeadingSlashIfNotExternal(spec.light.path),
    },
    dark: spec.dark && {
      ...spec.dark,
      path: ensureLeadingSlashIfNotExternal(spec.dark.path),
    },
  };
}

// this a typst workaround but might as well write it as a proper function
export function fillLogoPaths(
  brand: LightDarkBrand | undefined,
  spec: LogoLightDarkSpecifierPathOptional | undefined,
  order: BrandNamedLogo[],
): LogoLightDarkSpecifier | undefined {
  function findLogoSize(
    mode: "light" | "dark",
  ): string | undefined {
    if (brand?.[mode]) {
      for (const size of order) {
        if (brand[mode].processedData.logo[size]) {
          return size;
        }
      }
    }
    return undefined;
  }
  function resolveMode(
    mode: "light" | "dark",
    spec: LogoSpecifierPathOptional | undefined,
  ): LogoSpecifier | undefined {
    if (!spec) {
      return undefined;
    }
    if (!spec || typeof spec === "string") {
      return spec;
    } else if (spec.path) {
      return spec as LogoOptions;
    } else {
      const size = findLogoSize(mode) ||
        findLogoSize(mode === "light" ? "dark" : "light");
      if (size) {
        return {
          path: size,
          ...spec,
        };
      }
    }
    return undefined;
  }
  if (!spec || typeof spec === "string") {
    return spec;
  }
  if ("light" in spec || "dark" in spec) {
    return {
      light: resolveMode("light", spec.light),
      dark: resolveMode("dark", spec.dark),
    };
  }
  return {
    light: resolveMode("light", spec as LogoOptionsPathOptional),
    dark: resolveMode("dark", spec as LogoOptionsPathOptional),
  };
}

function splitColorLightDark(
  bcld: BrandColorLightDark,
): LightDarkColor {
  if (typeof bcld === "string") {
    return { light: bcld, dark: bcld };
  }
  return bcld;
}

const enablesDarkMode = (x: BrandColorLightDark | BrandStringLightDark) =>
  typeof x === "object" && x?.dark;

export function brandHasDarkMode(brand: BrandUnified): boolean {
  if (brand.color) {
    for (const colorName of Zod.BrandNamedThemeColor.options) {
      if (!brand.color[colorName]) {
        continue;
      }
      if (enablesDarkMode(brand.color![colorName])) {
        return true;
      }
    }
  }
  if (brand.typography) {
    for (const elementName of Zod.BrandNamedTypographyElements.options) {
      const element = brand.typography[elementName];
      if (!element || typeof element === "string") {
        continue;
      }
      if (
        "background-color" in element && element["background-color"] &&
        enablesDarkMode(element["background-color"])
      ) {
        return true;
      }
      if (
        "color" in element && element["color"] &&
        enablesDarkMode(element["color"])
      ) {
        return true;
      }
    }
  }
  if (brand.logo) {
    for (const logoName of Zod.BrandNamedLogo.options) {
      const logo = brand.logo[logoName];
      if (!logo || typeof logo === "string") {
        continue;
      }
      if (enablesDarkMode(logo)) {
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

function splitLogo(
  unifiedLogo: BrandLogoUnified,
): { light: BrandLogoSingle; dark: BrandLogoSingle } {
  const light: BrandLogoSingle = { images: unifiedLogo.images },
    dark: BrandLogoSingle = { images: unifiedLogo.images };
  for (const logoName of Zod.BrandNamedLogo.options) {
    if (unifiedLogo[logoName]) {
      if (typeof unifiedLogo[logoName] === "string") {
        light[logoName] = dark[logoName] = unifiedLogo[logoName];
        continue;
      }
      ({ light: light[logoName], dark: dark[logoName] } =
        unifiedLogo[logoName]);
    }
  }
  return { light, dark };
}

export function splitUnifiedBrand(
  unified: unknown,
  brandDir: string,
  projectDir: string,
): LightDarkBrandDarkFlag {
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
          ...(headingsColor?.[mode] && { color: headingsColor[mode] }),
        },
      monospace:
        !typography.monospace || typeof typography.monospace === "string"
          ? typography.monospace
          : {
            ...typography.monospace,
            ...(monospaceColor?.[mode] && { color: monospaceColor[mode] }),
            ...(monospaceBackgroundColor?.[mode] &&
              { "background-color": monospaceBackgroundColor[mode] }),
          },
      "monospace-inline": !typography["monospace-inline"] ||
          typeof typography["monospace-inline"] === "string"
        ? typography["monospace-inline"]
        : {
          ...typography["monospace-inline"],
          ...(monospaceInlineColor?.[mode] &&
            { color: monospaceInlineColor[mode] }),
          ...(monospaceInlineBackgroundColor?.[mode] &&
            { "background-color": monospaceInlineBackgroundColor[mode] }),
        },
      "monospace-block": !typography["monospace-block"] ||
          typeof typography["monospace-block"] === "string"
        ? typography["monospace-block"]
        : {
          ...typography["monospace-block"],
          ...(monospaceBlockColor?.[mode] &&
            { color: monospaceBlockColor[mode] }),
          ...(monospaceBlockBackgroundColor?.[mode] &&
            { "background-color": monospaceBlockBackgroundColor[mode] }),
        },
      link: !typography.link || typeof typography.link === "string"
        ? typography.link
        : {
          ...typography.link,
          ...(linkColor?.[mode] && { color: linkColor[mode] }),
          ...(linkBackgroundColor?.[mode] &&
            { "background-color": linkBackgroundColor[mode] }),
        },
    };
  const logos = unifiedBrand.logo && splitLogo(unifiedBrand.logo);
  const lightBrand: BrandSingle = {
    meta: unifiedBrand.meta,
    color: { palette: unifiedBrand.color && { ...unifiedBrand.color.palette } },
    typography: typography && specializeTypography(typography, "light"),
    logo: logos && logos.light,
    defaults: unifiedBrand.defaults,
  };
  const darkBrand: BrandSingle = {
    meta: unifiedBrand.meta,
    color: { palette: unifiedBrand.color && { ...unifiedBrand.color.palette } },
    typography: typography && specializeTypography(typography, "dark"),
    logo: logos && logos.dark,
    defaults: unifiedBrand.defaults,
  };
  if (unifiedBrand.color) {
    for (const colorName of Zod.BrandNamedThemeColor.options) {
      if (!unifiedBrand.color[colorName]) {
        continue;
      }
      const { light, dark } = splitColorLightDark(
        unifiedBrand.color[colorName],
      );

      if (light !== undefined) lightBrand.color![colorName] = light;
      if (dark !== undefined) darkBrand.color![colorName] = dark;
    }
  }
  return {
    light: new Brand(lightBrand, brandDir, projectDir),
    dark: new Brand(darkBrand, brandDir, projectDir),
    enablesDarkMode: brandHasDarkMode(unifiedBrand),
  };
}
