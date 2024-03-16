/*
 * project-crossrefs.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { basename, isAbsolute, join, relative } from "../deno_ral/path.ts";
import {
  kCrossref,
  kCrossrefChapterId,
  kCrossrefChaptersAlpha,
  kCrossrefChaptersAppendix,
} from "../config/constants.ts";
import { Metadata } from "../config/types.ts";
import { pathWithForwardSlashes } from "../core/path.ts";
import { shortUuid } from "../core/uuid.ts";

import { projectScratchPath } from "./project-scratch.ts";

export const kCrossrefIndexFile = "crossref-index-file";
export const kCrossrefInputType = "crossref-input-type";
export const kCrossrefResolveRefs = "crossref-resolve-refs";

const kCrossrefIndexDir = "xref";

type CrossrefIndex = Record<string, Record<string, string>>;

export function crossrefIndexForOutputFile(
  projectDir: string,
  input: string,
  output: string,
) {
  // ensure we are dealing with a project relative path to the input
  // that uses forward slashes
  if (isAbsolute(input)) {
    input = relative(projectDir, input);
  }
  input = pathWithForwardSlashes(input);

  // read (or create) main index
  const crossrefDir = projectScratchPath(projectDir, kCrossrefIndexDir);
  ensureDirSync(crossrefDir);
  const mainIndexFile = join(crossrefDir, "INDEX");
  const mainIndex: CrossrefIndex = existsSync(mainIndexFile)
    ? JSON.parse(Deno.readTextFileSync(mainIndexFile))
    : {};

  // ensure this input/output has an index entry
  // (generate and rewrite index file if not)
  const outputBaseFile = basename(output);
  if (mainIndex[input]?.[outputBaseFile] === undefined) {
    if (mainIndex[input] === undefined) {
      mainIndex[input] = {};
    }
    mainIndex[input][outputBaseFile] = shortUuid();
    Deno.writeTextFileSync(
      mainIndexFile,
      JSON.stringify(mainIndex, undefined, 2),
    );
  }

  // return the file path
  return join(crossrefDir, mainIndex[input]?.[outputBaseFile]);
}

export function deleteCrossrefMetadata(metadata: Metadata) {
  const crossref = metadata[kCrossref] as Metadata;
  if (crossref) {
    delete crossref[kCrossrefChaptersAppendix];
    delete crossref[kCrossrefChaptersAlpha];
    delete crossref[kCrossrefChapterId];
    if (Object.keys(crossref).length === 0) {
      delete metadata[kCrossref];
    }
  }
}
