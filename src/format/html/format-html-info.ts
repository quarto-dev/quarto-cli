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
// Metadata alone cannot tell whether a brand file was ignored (e.g. it only
// holds comments), so darkModeDefault checks `brand:` key order against the
// loaded brand.
export function darkModeDefaultMetadata(
  metadata: Metadata,
): boolean | undefined {
  return darkModeFromKeyOrder(metadata[kTheme]) ??
    darkModeFromKeyOrder(metadata[kBrand]);
}

export function darkModeDefault(format: Format): boolean | undefined {
  const fromTheme = darkModeFromKeyOrder(format.metadata?.[kTheme]);
  if (fromTheme !== undefined) {
    return fromTheme;
  }
  if (format.render.brand?.dark) {
    // a unified brand has no author preference but it can have dark mode
    return darkModeFromKeyOrder(format.metadata?.[kBrand]) ?? false;
  }
  return undefined;
}

// true/false when `dark` is a key (true when it is listed first),
// undefined when there is no `dark` key
function darkModeFromKeyOrder(value: unknown): boolean | undefined {
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.includes("dark")) {
      return keys[0] === "dark";
    }
  }
  return undefined;
}
