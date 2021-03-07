/*
* crossref.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { resourcePath } from "../../core/resources.ts";
import {
  kListings,
  kNumberOffset,
  kNumberSections,
  kTopLevelDivision,
} from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";

import { PandocOptions } from "./pandoc.ts";

export function crossrefFilter() {
  return resourcePath("filters/crossref/crossref.lua");
}

export function crossrefFilterActive(format: Format) {
  return !!format.metadata.crossref;
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

export function crossrefFilterParams(options: PandocOptions) {
  const kCrossrefFilterParams = [kListings, kNumberSections, kNumberOffset];
  const params: Metadata = {};
  kCrossrefFilterParams.forEach((option) => {
    const value = crossrefOption(option, options);
    if (value) {
      // validation
      if (option === kNumberOffset) {
        if (
          !Array.isArray(value) || value.some((num) => !Number.isInteger(num))
        ) {
          throw new Error(
            "Invalid value for number-offset (should be an array of numbers)",
          );
        }
      }

      params[option] = value;
    }
  });
  return params;
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
