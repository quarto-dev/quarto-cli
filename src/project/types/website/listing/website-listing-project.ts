/*
* website-listing-project.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureDirSync } from "fs/mod.ts";
import { dirname, join } from "../../../../deno_ral/path.ts";

import { projectScratchPath } from "../../../project-scratch.ts";
import { ProjectContext } from "../../../types.ts";
import { ListingDescriptor } from "./website-listing-shared.ts";

const kListingDir = "listing";
const kListingMapFile = "listing-cache.json";

export type ProjRelativeListingPath = string;
export type Glob = string;

export type ListingMap = Record<ProjRelativeListingPath, Array<Glob>>;
export interface ListingCache {
  listingMap?: ListingMap;
}

// Adds data to the project listing cache
// This should be called anytime that a listing is rendered
export function cacheListingProjectData(
  project: ProjectContext,
  listingPath: ProjRelativeListingPath,
  descriptors: ListingDescriptor[],
) {
  // Read the globs / files from contents
  const listingContents = descriptors.flatMap((descriptor) => {
    const contentItems = descriptor.listing.contents;
    return contentItems.filter((item) => {
      return typeof (item) === "string";
    });
  }) as string[];

  // Store the globs in a dictionary (file > glob[])
  const cache: ListingCache = readListingMap(project) || {};
  const listingMap = cache.listingMap || {};

  listingContents.forEach((content) => {
    const globSet = new Set(listingMap[listingPath] || []);
    globSet.add(content);
    listingMap[listingPath] = [...globSet];
  });

  // Write it to scratch path
  writeListingCache(project, {
    listingMap,
  });
}

// Read project listing cache
export function listingProjectData(project: ProjectContext) {
  return readListingMap(project);
}

// Clear project listing cache
export function clearListingProjectData(project: ProjectContext) {
  clearListingMap(project);
}

function clearListingMap(project: ProjectContext) {
  const file = projectListingMapFile(project.dir);
  try {
    Deno.removeSync(file);
  } catch {
    // No op
  }
}

function readListingMap(project: ProjectContext) {
  const file = projectListingMapFile(project.dir);
  try {
    const mapRaw = Deno.readTextFileSync(file);
    const data = JSON.parse(mapRaw);
    return data as ListingCache;
  } catch {
    return {} as ListingCache;
  }
}

function writeListingCache(project: ProjectContext, cache: ListingCache) {
  const file = projectListingMapFile(project.dir);
  ensureDirSync(dirname(file));
  const mapJson = JSON.stringify(cache, undefined, 2);
  Deno.writeTextFileSync(file, mapJson);
}

function projectListingMapFile(dir: string) {
  return join(projectScratchPath(dir, kListingDir), kListingMapFile);
}
