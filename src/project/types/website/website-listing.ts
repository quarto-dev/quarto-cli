/*
* website-listing
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, relative } from "path/mod.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { ld } from "lodash/mod.ts";

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
import { renderEjs } from "../../../core/ejs.ts";
import { resourcePath } from "../../../core/resources.ts";

// The core listing type
export interface Listing {
  id: string;
  type: ListingType;
  contents: string[]; // globs
  classes: string[];
  sort?: ListingSort[];
}

export interface ListingSort {
  field: "title" | "author" | "date" | "filename";
  direction: "asc" | "desc";
}

// An individual listing item
export interface ListingItem {
  title?: string;
  description?: string;
  author?: string[];
  date?: Date;
  image?: string;
  path: string;
  filename: string;
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
    const items: ListingItem[] = [];

    // Read the metadata for each of the listing files
    for (const input of listingResolved.files) {
      const projectRelativePath = relative(project.dir, input);
      const target = await inputTargetIndex(
        project,
        projectRelativePath,
      );

      const documentMeta = target?.markdown.yaml;
      const description = documentMeta?.description as string || "";
      const image = documentMeta?.image as string;
      const date = documentMeta?.date as Date;
      const author = Array.isArray(documentMeta?.author)
        ? documentMeta?.author
        : [documentMeta?.author];
      const filename = basename(projectRelativePath);

      items.push({
        title: target?.title,
        date,
        author,
        image,
        description,
        path: `/${projectRelativePath}`,
        filename,
      });
    }

    // Sort the items (first array is of sort functions)
    // second array is of sort direction
    const sortedAndFiltered = (): ListingItem[] => {
      if (listing.sort && listing.sort.length > 0) {
        return ld.orderBy(
          items,
          listing.sort.map((l) => {
            return (item: ListingItem) => {
              return item[l.field];
            };
          }),
          listing.sort.map((l) => l.direction),
        );
      } else {
        return items;
      }
    };
    const orderedItems = sortedAndFiltered();

    listingItems.push({
      listing,
      items: orderedItems,
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
  switch (listing.type) {
    case ListingType.Table:
      return tableTypeHandler(listing, items);
    case ListingType.Grid:
      return gridTypeHandler(listing, items);
    case ListingType.Cards:
    default:
      return cardTypeHandler(listing, items);
  }
}

function getListingContainer(doc: Document, listing: Listing) {
  // See if there is a target div already in the page
  let listingEl = doc.getElementById(listing.id);
  if (listingEl === null) {
    // No target div, cook one up
    const content = doc.querySelector("#quarto-content main.content");
    if (content) {
      listingEl = doc.createElement("div");
      listingEl.id = listing.id;
      content.appendChild(listingEl);
    }
  }

  // Append any requested classes
  listing.classes.forEach((clz) => listingEl?.classList.add(clz));

  return listingEl;
}

// The markdown that we'll generate for a card
const cardMarkdown = (item: ListingItem) => {
  return renderEjs(
    resourcePath("projects/website/listing/card.ejs.md"),
    { item },
    false,
  );
};

const cardTypeHandler = (listing: Listing, items: ListingItem[]) => {
  const key = (item: ListingItem) => {
    return `${listing.id}-${item.path}`;
  };

  return {
    getUnrendered() {
      const unrendered: PipelineMarkdown = { blocks: {} };
      items.forEach((item) => {
        if (item.title) {
          unrendered.blocks![key(item)] = cardMarkdown(item);
        }
      });
      return unrendered;
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const listingEl = getListingContainer(doc, listing);
      items.forEach((item) => {
        const renderedEl = rendered[key(item)];
        if (renderedEl) {
          for (const child of renderedEl.children) {
            listingEl?.appendChild(child);
          }
        }
      });
    },
  };
};

// The markdown that we'll generate for a card
const gridCardMarkdown = (item: ListingItem) => {
  return renderEjs(
    resourcePath("projects/website/listing/grid-card.ejs.md"),
    { item },
    false,
  );
};

const gridTypeHandler = (listing: Listing, items: ListingItem[]) => {
  const key = (item: ListingItem) => {
    return `${listing.id}-${item.path}`;
  };

  return {
    getUnrendered() {
      const unrendered: PipelineMarkdown = { blocks: {} };
      items.forEach((item) => {
        if (item.title) {
          unrendered.blocks![key(item)] = gridCardMarkdown(item);
        }
      });
      return unrendered;
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const listingEl = getListingContainer(doc, listing);
      listingEl?.classList.add("grid");

      items.forEach((item) => {
        const renderedEl = rendered[key(item)];
        if (renderedEl) {
          for (const child of renderedEl.children) {
            listingEl?.appendChild(child);
          }
        }
      });
    },
  };
};

const tableTypeHandler = (listing: Listing, items: ListingItem[]) => {
  return {
    getUnrendered() {
      const unrendered: PipelineMarkdown = {
        blocks: {
          [listing.id]: tableMarkdown(items),
        },
      };
      return unrendered;
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const listingEl = getListingContainer(doc, listing);
      const renderedEl = rendered[listing.id];
      for (const child of renderedEl.children) {
        listingEl?.appendChild(child);
      }
    },
  };
};

const tableMarkdown = (items: ListingItem[]) => {
  return renderEjs(
    resourcePath("projects/website/listing/table.ejs.md"),
    { items },
    false,
  );
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
      classes: [],
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
    classes: maybeArray(meta.classes) || [],
    sort: resolveListingSort(meta.sort),
  };
}

function toSortKey(key: string) {
  switch (key) {
    case "title":
      return "title";
    case "author":
      return "author";
    case "date":
      return "date";
    case "filename":
      return "filename";
    default:
      return "filename";
  }
}

function resolveListingSort(rawValue: unknown): ListingSort[] | undefined {
  const parseValue = (sortValue: unknown): ListingSort | undefined => {
    if (sortValue == undefined) {
      return undefined;
    }

    if (typeof (sortValue) === "string") {
      const sortStr = sortValue as string;
      const parts = sortStr.split(" ");
      if (parts.length === 2) {
        return {
          field: toSortKey(parts[0]),
          direction: parts[1] === "asc" ? "asc" : "desc",
        };
      } else {
        return {
          field: toSortKey(parts[0]),
          direction: "desc",
        };
      }
    }
  };

  if (Array.isArray(rawValue)) {
    return rawValue.map(parseValue).filter((val) =>
      val !== undefined
    ) as ListingSort[];
  } else {
    const sort = parseValue(rawValue);
    if (sort) {
      return [sort];
    }
  }
  return undefined;
}

function resolveListingStr(val: string): Listing {
  switch (val) {
    case ListingType.Grid:
      return {
        id: kDefaultId,
        type: ListingType.Grid,
        contents: kDefaultContentsGlob,
        classes: [],
      };

    case ListingType.Cards:
      return {
        id: kDefaultId,
        type: ListingType.Cards,
        contents: kDefaultContentsGlob,
        classes: [],
      };

    case ListingType.Table:
      return {
        id: kDefaultId,
        type: ListingType.Table,
        contents: kDefaultContentsGlob,
        classes: [],
      };
  }

  // Since it isn't a type of listing, treat it as a path
  return {
    id: kDefaultId,
    type: kDefaultListingType,
    contents: [val],
    classes: [],
  };
}
