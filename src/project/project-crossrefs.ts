/*
* project-crossrefs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { isAbsolute, join, relative } from "path/mod.ts";
import {
  kCrossref,
  kCrossrefChapterId,
  kCrossrefChaptersAlpha,
} from "../config/constants.ts";
import { Metadata } from "../config/metadata.ts";

import { projectScratchPath } from "./project-scratch.ts";

export const kCrossrefIndexFile = "crossref-index-file";
export const kCrossrefResolveRefs = "crossref-resolve-refs";

export function crossrefIndexForOutputFile(projectDir: string, output: string) {
  if (isAbsolute(output)) {
    output = relative(projectDir, output);
  }
  return projectScratchPath(projectDir, join("crossrefs", `${output}.json`));
}

export function deleteCrossrefMetadata(metadata: Metadata) {
  const crossref = metadata[kCrossref] as Metadata;
  if (crossref) {
    delete crossref[kCrossrefChaptersAlpha];
    delete crossref[kCrossrefChapterId];
    if (Object.keys(crossref).length === 0) {
      delete metadata[kCrossref];
    }
  }
}
