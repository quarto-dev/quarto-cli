/*
* resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ResolvedPathGlobs, resolvePathGlobs } from "../../core/path.ts";
import { engineIgnoreGlobs } from "../../execute/engine.ts";
import { kQuartoScratch } from "../../project/project-scratch.ts";
import { extractResolvedResourceFilenamesFromQmd } from "../../execute/ojs/extract-resources.ts";
import { asMappedString } from "../../core/mapped-text.ts";

export function resourcesFromMetadata(resourcesMetadata?: unknown) {
  // interrogate / typecast raw yaml resources into array of strings
  const resources: string[] = [];
  if (resourcesMetadata) {
    if (Array.isArray(resourcesMetadata)) {
      for (const file of resourcesMetadata) {
        resources.push(String(file));
      }
    } else {
      resources.push(String(resourcesMetadata));
    }
  }
  return resources;
}

// FIXME markdown should come as a MappedString but we don't want to port
// over the entirety of quarto just yet.
export async function resolveFileResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
  globs: string[],
): Promise<ResolvedPathGlobs> {
  const ignore = engineIgnoreGlobs()
    .concat(kQuartoScratch + "/")
    .concat(["**/.*", "**/.*/**"]); // hidden (dot prefix))
  const resources = resolvePathGlobs(fileDir, globs, ignore);
  if (markdown.length > 0) {
    resources.include.push(
      ...(await extractResolvedResourceFilenamesFromQmd(
        asMappedString(markdown),
        fileDir,
        rootDir,
      )),
    );
  }
  return resources;
}
