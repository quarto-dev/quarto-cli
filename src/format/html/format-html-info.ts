/*
 * format-html-info.ts
 *
 * functions to obtain information about qmd files in HTML format
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kTheme } from "../../config/constants.ts";
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
    return darkModeDefault(format.metadata);
  }
  return undefined;
}

export function darkModeDefault(metadata?: Metadata): boolean | undefined {
  if (metadata !== undefined) {
    const theme = metadata[kTheme];
    if (theme && typeof (theme) === "object") {
      const keys = Object.keys(theme);
      if (keys.includes("dark")) {
        if (keys[0] === "dark") {
          return true;
        } else {
          return false;
        }
      }
    }
  }
  return undefined;
}
