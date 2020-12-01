/*
* crossref.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  kListings,
  kNumberOffset,
  kNumberSections,
  kTopLevelDivision,
} from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";

import { PandocOptions } from "./pandoc.ts";

const kForwardedCrossrefOptions = [kListings, kNumberSections, kNumberOffset];

export function crossrefFilterActive(format: Format) {
  return format.metadata.crossref !== false;
}

export function crossrefGeneratedDefaults(options: PandocOptions) {
  // if the chapters options is set and there is no explicit top-level-division
  // then set the top-level-division to chapters
  if (typeof options.format.metadata.crossref === "object") {
    const crossref = options.format.metadata.crossref as Record<
      string,
      unknown
    >;
    if (crossref.chapters) {
      const defaults: Record<string, unknown> = {};
      if (crossrefOption(kTopLevelDivision, options) === undefined) {
        defaults[kTopLevelDivision] = "chapter";
      }
      if (crossrefOption(kNumberSections, options) === undefined) {
        defaults[kNumberSections] = true;
      }
      return defaults;
    }
  }

  // return no defaults
  return undefined;
}

export function forwardCrossrefOptions(options: PandocOptions) {
  // forward all values
  kForwardedCrossrefOptions.forEach((name) => {
    const value = crossrefOption(name, options);
    if (value) {
      setCrossrefMetadata(options.format, name, value);
    }
  });

  // additionally, --number-offset implies --number-sections
  if (crossrefOption(kNumberOffset, options)) {
    setCrossrefMetadata(options.format, kNumberSections, true);
  }
}

export function cleanForwardedCrossrefMetadata(metadata: Metadata) {
  // cleanup synthesized crossref metadata
  if (metadata.crossref) {
    const crossref = metadata.crossref as Record<string, unknown>;
    kForwardedCrossrefOptions.forEach((name) => {
      if (crossref[name] !== undefined) {
        delete crossref[name];
      }
    });
    if (crossref.listings !== undefined) {
      delete crossref.listings;
    }
    if (crossref[kNumberSections] !== undefined) {
      delete crossref[kNumberSections];
    }
    if (Object.keys(crossref).length === 0) {
      delete metadata.crossref;
    }
  }
}

function crossrefOption(name: string, options: PandocOptions) {
  if (options.flags && Object.keys(options.flags).includes(name)) {
    // deno-lint-ignore no-explicit-any
    return (options.flags as any)[name];
  } else if (Object.keys(options.format.pandoc).includes(name)) {
    // deno-lint-ignore no-explicit-any
    return (options.format.pandoc as any)[name];
  } else {
    return undefined;
  }
}

function setCrossrefMetadata(
  format: Format,
  key: string,
  value: unknown,
) {
  if (typeof format.metadata.crossref !== "object") {
    format.metadata.crossref = {} as Record<string, unknown>;
  }
  // deno-lint-ignore no-explicit-any
  (format.metadata.crossref as any)[key] = value;
}
