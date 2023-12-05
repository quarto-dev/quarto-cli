/*
 * website-listing-index.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { ProjectContext } from "../../../types.ts";
import { ListingDescriptor, ListingItem } from "./website-listing-shared.ts";
import { dirAndStem } from "../../../../core/path.ts";
import { uniqBy } from "../../../../core/lodash.ts";
import { resolveInputTarget } from "../../../project-index.ts";
import { ProjectOutputFile } from "../../types.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { kListing } from "./website-listing-shared.ts";
import { warning } from "log/mod.ts";
import { isHtmlOutput } from "../../../../config/format.ts";

export async function createListingIndex(
  source: string,
  project: ProjectContext,
  descriptors: ListingDescriptor[],
) {
  const projectRelInput = relative(project.dir, source);
  const inputTarget = await resolveInputTarget(project, projectRelInput, false);
  if (inputTarget) {
    const listingHref = "/" + inputTarget.outputHref;

    const items: ListingItem[] = [];
    for (const descriptor of descriptors) {
      items.push(...descriptor.items);
    }
    const filteredItems = uniqBy(items, (item: ListingItem) => {
      return item.path;
    });

    if (filteredItems) {
      const itemHrefs: string[] = [];
      for (const item of filteredItems) {
        if (item.path) {
          const itemTarget = await resolveInputTarget(
            project,
            item.path,
            false,
          );
          if (itemTarget) {
            const itemHref = itemTarget.outputHref;
            itemHrefs.push(itemHref);
          }
        }
      }

      const listingJson = {
        listing: listingHref,
        items: itemHrefs,
      };

      const listingIndexPath = listingIndex(source);
      Deno.writeTextFileSync(
        listingIndexPath,
        JSON.stringify(listingJson, undefined, 2),
      );

      return listingIndexPath;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

interface ListingPaths {
  listing: string;
  paths: string[];
}

export function updateGlobalListingIndex(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  // calculate output dir and search.json path
  const outputDir = projectOutputDir(context);
  const listingJsonPath = join(outputDir, "listings.json");
  const listingJson = existsSync(listingJsonPath)
    ? Deno.readTextFileSync(listingJsonPath)
    : undefined;

  // start with a set of search docs if this is incremental
  const listingPaths = new Array<ListingPaths>();
  let generateListings = true;
  if (incremental && listingJson) {
    // Read the existing index
    try {
      const existingListingJson = JSON.parse(listingJson);
      listingPaths.push(...(existingListingJson as ListingPaths[]));
    } catch {
      generateListings = false;
      warning(
        "Unable to read listing index - it may be corrupt. Please re-render the entire site to create a valid listing index.",
      );
    }
  }

  // Go through output files and for each one, see if there is a listing index.
  if (generateListings) {
    for (const outputFile of outputFiles) {
      const hasListing = !!outputFile.format.metadata[kListing];
      if (hasListing && isHtmlOutput(outputFile.format.pandoc, true)) {
        const indexPath = listingIndex(outputFile.file);
        if (existsSync(indexPath)) {
          const json = Deno.readTextFileSync(indexPath);
          const indexJson = JSON.parse(json) as ListingPaths;

          const existingIndex = listingPaths.findIndex((paths) =>
            paths.listing === indexJson.listing
          );
          if (existingIndex > -1) {
            listingPaths[existingIndex] = indexJson;
          } else {
            listingPaths.push(indexJson);
          }

          Deno.removeSync(indexPath);
        }
      }
    }

    if (listingPaths.length > 0) {
      Deno.writeTextFileSync(
        listingJsonPath,
        JSON.stringify(listingPaths, undefined, 2),
      );
    }
  }
}

function listingIndex(input: string) {
  const [dir, stem] = dirAndStem(input);
  return join(dir, `${stem}-listing.json`);
}
