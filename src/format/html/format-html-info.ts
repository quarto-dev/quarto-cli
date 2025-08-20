/*
 * format-html-info.ts
 *
 * functions to obtain information about qmd files in HTML format
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kBrand, kTheme } from "../../config/constants.ts";
import { isHtmlDashboardOutput, isHtmlOutput } from "../../config/format.ts";
import { Format, Metadata } from "../../config/types.ts";

export function formatHasBootstrap(format: Format) {
  if (
    format &&
    (isHtmlOutput(format.pandoc, true) ||
      isHtmlDashboardOutput(format.identifier["base-format"]))
  ) {
    return hasBootstrapTheme(format.metadata);
  } else {
    return false;
  }
}

export function hasBootstrapTheme(metadata: Metadata) {
  const theme = metadata[kTheme];
  return theme !== "none" && theme !== "pandoc";
}

// Returns a boolean indicating whether dark mode is requested
// (true or false) or undefined if the dark mode support isn't present
// Key order determines whether dark mode is true or false
export function formatDarkMode(format: Format): boolean | undefined {
  const isBootstrap = formatHasBootstrap(format);
  if (isBootstrap) {
    return darkModeDefault(format);
  }
  return undefined;
}

// there are two stages of knowing whether dark mode is enabled:
// 1. from the start we can look at theme and brand metadata to see if there is
//   a dark theme or brand
// 2. later, after brand is loaded, we'll know whether unified brand enabled dark mode
// in practice, we only know
export function darkModeDefaultMetadata(
  metadata: Metadata,
): boolean | undefined {
  if (metadata[kTheme] && typeof metadata[kTheme] === "object") {
    const keys = Object.keys(metadata[kTheme]);
    if (keys.includes("dark")) {
      if (keys[0] === "dark") {
        return true;
      } else {
        return false;
      }
    }
  }
  if (metadata[kBrand] && typeof metadata[kBrand] === "object") {
    const keys = Object.keys(metadata[kBrand]);
    if (keys.includes("dark")) {
      if (keys[0] === "dark") {
        return true;
      } else {
        return false;
      }
    }
  }
  return undefined;
}
export function darkModeDefault(format: Format): boolean | undefined {
  const metadata = format.metadata;
  if (metadata !== undefined) {
    const dmdm = darkModeDefaultMetadata(metadata);
    if (dmdm !== undefined) {
      return dmdm;
    }
  }
  const brand = format.render.brand;
  if (brand && brand.dark) {
    // unified brand has no author preference but it can have dark mode
    return false;
  }
  return undefined;
}
