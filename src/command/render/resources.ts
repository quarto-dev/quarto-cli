/*
* resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ResolvedPathGlobs, resolvePathGlobs } from "../../core/path.ts";
import { engineIgnoreGlobs } from "../../execute/engine.ts";
import { kQuartoScratch } from "../../project/project-scratch.ts";
import { extractResourcesFromQmd } from "../../execute/ojs/extract-resources.ts";
import { dirname, basename, relative, join } from "path/mod.ts";

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

export function resolveFileResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
  globs: string[],
): ResolvedPathGlobs {
  const ignore = engineIgnoreGlobs()
    .concat(kQuartoScratch + "/")
    .concat(["**/.*", "**/.*/**"]); // hidden (dot prefix))
  const resources = resolvePathGlobs(fileDir, globs, ignore);
  if (markdown.length > 0) {
    resources.include.push(...ojsResources(rootDir, fileDir, markdown));
  }
  return resources;
}

function ojsResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
): string[] {
  const projRelativeResources = extractResourcesFromQmd(markdown, fileDir, rootDir);
  return projRelativeResources.map(resource => relative(fileDir, join(rootDir, resource)));
}
