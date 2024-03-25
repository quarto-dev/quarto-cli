/*
 * crossref.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

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
  kCrossrefInputType,
} from "../../project/project-crossrefs.ts";
import { pandocMetadataPath } from "./render-paths.ts";
import { isMultiFileBookFormat } from "../../project/types/book/book-shared.ts";
import { projectIsBook } from "../../project/project-shared.ts";

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
        if (typeof value === "number") {
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
  if (!options.project?.isSingleFile) {
    // if its a book then only write for multi-file (as otherwise all of the
    // crossref entries will end in a single index file)
    if (
      !projectIsBook(options.project) || isMultiFileBookFormat(options.format)
    ) {
      params[kCrossrefIndexFile] = pandocMetadataPath(
        crossrefIndexForOutputFile(
          options.project!.dir,
          options.source,
          options.output,
        ),
      );
    }

    // caller may have requested that a crossref index be written
  } else {
    const crossrefIndex = Deno.env.get("QUARTO_CROSSREF_INDEX_PATH");
    if (crossrefIndex) {
      params[kCrossrefIndexFile] = pandocMetadataPath(crossrefIndex);
    }
  }

  // caller may have requested a special input type
  const crossrefInputType = Deno.env.get("QUARTO_CROSSREF_INPUT_TYPE");
  if (crossrefInputType) {
    params[kCrossrefInputType] = crossrefInputType;
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
