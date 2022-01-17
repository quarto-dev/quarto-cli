/*
* website-listing
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, relative } from "path/mod.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
} from "../../../config/types.ts";
import { resolvePathGlobs } from "../../../core/path.ts";
import { inputTargetIndex } from "../../project-index.ts";
import { ProjectContext } from "../../types.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
  PipelineMarkdown,
} from "./website-pipeline-md.ts";

// The core listing type
export interface Listing {
  id: string;
  type: ListingType;
  contents: string[]; // globs
}

// An individual listing item
export interface ListingItem {
  title?: string;
  relativePath: string;
}

// The type of listing
export enum ListingType {
  Grid = "grid",
  Cards = "cards",
  Table = "table",
}

// Defaults (a card listing that contains everything
// in the source document's directory)
const kDefaultListingType = ListingType.Cards;
const kDefaultContentsGlob = ["*"];
const kDefaultId = "quarto-listing";

export const kListing = "listing";

export async function listingHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  _extras: FormatExtras,
) {
  // Read listing data from document metadata
  const listings = normalizeListingConfiguration(format);

  // Resolve the content globs
  const listingsResolved = resolveListingContents(source, listings);

  // Generate the list of items for this listing
  const listingItems: { listing: Listing; items: ListingItem[] }[] = [];
  for (const listingResolved of listingsResolved) {
    const listing = listingResolved.listing;
    const items = [];

    // Read the metadata for each of the listing files
    for (const input of listingResolved.files) {
      const relativePath = relative(project.dir, input);
      const target = await inputTargetIndex(
        project,
        relativePath,
      );
      items.push({
        title: target?.title,
        relativePath,
      });
    }

    listingItems.push({
      listing,
      items,
    });
  }

  const pipelines: MarkdownPipeline[] = [];
  listingItems.forEach((listingItem) => {
    const pipelineName = `quarto-listing-${listingItem.listing.id}`;

    const pipeline = createMarkdownPipeline(
      pipelineName,
      [markdownHandler(listingItem.listing, listingItem.items)],
    );

    pipelines.push(pipeline);
  });

  return {
    [kHtmlPostprocessors]: (doc: Document) => {
      pipelines.forEach((pipe) => {
        pipe.processRenderedMarkdown(doc);
      });
      return Promise.resolve([]);
    },
    [kMarkdownAfterBody]: pipelines.map((pipe) => pipe.markdownAfterBody())
      .join("\n\n"),
  };
}

function markdownHandler(
  listing: Listing,
  items: ListingItem[],
) {
  return cardTypeHandler(listing, items);
}

const cardTypeHandler = (listing: Listing, items: ListingItem[]) => {
  const key = (item: ListingItem) => {
    return `${listing.id}-${item.relativePath}`;
  };

  return {
    getUnrendered() {
      const unrendered: PipelineMarkdown = { inlines: {} };
      items.forEach((item) => {
        if (item.title) {
          unrendered.inlines![key(item)] = `\n_${item.title}_\n`;
        }
      });
      return unrendered;
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      // See if there is a target div already in the page
      let listingEl = doc.getElementById(listing.id);
      if (listingEl === null) {
        // No target div, cook one up
        const content = doc.getElementById("quarto-content");
        if (content) {
          listingEl = doc.createElement("div");
          listingEl.id = listing.id;
          content.appendChild(listingEl);
        }
      }
      items.forEach((item) => {
        const renderedEl = rendered[key(item)];
        if (renderedEl) {
          renderedEl.childNodes.forEach((node) => {
            listingEl?.appendChild(node);
          });
        }
      });
    },
  };
};

function resolveListingContents(source: string, listings: Listing[]) {
  return listings.map((listing) => {
    const currentDir = dirname(source);

    // Find matching files (excluding the source file for the listing page)
    const resolvedGlobs = resolvePathGlobs(currentDir, listing.contents, [
      source,
    ]);

    return {
      listing,
      files: resolvedGlobs.include,
    };
  });
}

// Processes the 'listing' metadata into an
// array of Listings to be processed
function normalizeListingConfiguration(
  format: Format,
): Listing[] {
  const listingConfig = format.metadata[kListing];
  const listings: Listing[] = [];
  if (typeof (listingConfig) == "string") {
    // Resolve this string
    const listing = resolveListingStr(listingConfig);
    if (listing) {
      listings.push(listing);
    }
  } else if (Array.isArray(listingConfig)) {
    // Process an array of listings
    const listingConfigs = listingConfig.filter((listing) =>
      typeof (listing) === "object"
    );
    let count = 0;
    listings.push(...listingConfigs.map((listing) => {
      return resolveListing(listing, () => {
        count = count + 1;
        return `${kDefaultId}-${count}`;
      });
    }));
  } else if (listingConfig && typeof (listingConfig) === "object") {
    // Process an individual listing
    listings.push(
      resolveListing(listingConfig as Record<string, unknown>, () => {
        return kDefaultId;
      }),
    );
  } else if (listingConfig) {
    // Process a boolean that is true
    listings.push({
      id: kDefaultId,
      type: kDefaultListingType,
      contents: kDefaultContentsGlob,
    });
  }
  return listings;
}

function resolveListing(meta: Record<string, unknown>, synthId: () => string) {
  const maybeArray = (val: unknown) => {
    if (val) {
      if (Array.isArray(val)) {
        return val;
      } else {
        return [val];
      }
    }
  };

  return {
    id: meta.id as string || synthId(),
    type: meta.type as ListingType || kDefaultListingType,
    contents: maybeArray(meta.contents) as string[] || kDefaultContentsGlob,
  };
}

function resolveListingStr(val: string): Listing {
  switch (val) {
    case ListingType.Grid:
      return {
        id: kDefaultId,
        type: ListingType.Grid,
        contents: kDefaultContentsGlob,
      };

    case ListingType.Cards:
      return {
        id: kDefaultId,
        type: ListingType.Cards,
        contents: kDefaultContentsGlob,
      };

    case ListingType.Table:
      return {
        id: kDefaultId,
        type: ListingType.Table,
        contents: kDefaultContentsGlob,
      };
  }

  // Since it isn't a type of listing, treat it as a path
  return {
    id: kDefaultId,
    type: kDefaultListingType,
    contents: [val],
  };
}
