/*
* crossref.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { resourcePath } from "../../core/resources.ts";
import {
  kListings,
  kNumberDepth,
  kNumberOffset,
  kNumberSections,
} from "../../config/constants.ts";
import { FormatPandoc } from "../../config/types.ts";
import { PandocFlags } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";

import { PandocOptions } from "./types.ts";
import {
  crossrefIndexForOutputFile,
  kCrossrefIndexFile,
} from "../../project/project-crossrefs.ts";
import { pandocMetadataPath } from "./render-paths.ts";

export function crossrefFilter() {
  return resourcePath("filters/crossref/crossref.lua");
}

export function crossrefFilterActive(options: PandocOptions) {
  return options.format.metadata.crossref !== false;
}

export function crossrefFilterParams(
  options: PandocOptions,
  defaults?: FormatPandoc,
) {
  const flags = options.flags;
  const metadata = options.format.metadata;
  const kCrossrefFilterParams = [kListings, kNumberSections, kNumberOffset];
  const params: Metadata = {};
  kCrossrefFilterParams.forEach((option) => {
    let value = crossrefOption(option, flags, defaults);
    if (value) {
      // validation
      if (option === kNumberOffset) {
        // coerce scalar number-offset to array
        if (typeof (value) === "number") {
          value = [value];
        }
        // validate we have an array
        if (
          !Array.isArray(value) || value.some((num) => !Number.isInteger(num))
        ) {
          throw new Error(
            "Invalid value for number-offset (should be an array of numbers)",
          );
        }
        // implies number-sections
        if (defaults?.[kNumberSections] === undefined) {
          params[kNumberSections] = true;
        }
      }
      params[option] = value;
    }
  });

  // Read the number depth
  params[kNumberDepth] = metadata?.[kNumberDepth];

  // always create crossref index for projects
  if (options.project) {
    params[kCrossrefIndexFile] = pandocMetadataPath(
      crossrefIndexForOutputFile(
        options.project!.dir,
        options.source,
        options.output,
      ),
    );
    // caller may have requested that a crossref index be written
  } else {
    const crossrefIndex = Deno.env.get("QUARTO_CROSSREF_INDEX_PATH");
    if (crossrefIndex) {
      params[kCrossrefIndexFile] = pandocMetadataPath(crossrefIndex);
    }
  }

  return params;
}

function crossrefOption(
  name: string,
  flags?: PandocFlags,
  defaults?: FormatPandoc,
) {
  if (flags && Object.keys(flags).includes(name)) {
    // deno-lint-ignore no-explicit-any
    return (flags as any)[name];
  } else if (Object.keys(defaults || {}).includes(name)) {
    // deno-lint-ignore no-explicit-any
    return (defaults as any)[name];
  } else {
    return undefined;
  }
}
