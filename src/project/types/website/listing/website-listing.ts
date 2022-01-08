/*
* website-listing
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, relative } from "path/mod.ts";
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import { ld } from "lodash/mod.ts";

import {
  Format,
  FormatDependency,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
} from "../../../../config/types.ts";
import { filterPaths } from "../../../../core/path.ts";
import { inputTargetIndex } from "../../../project-index.ts";
import { ProjectContext } from "../../../types.ts";
import {
  createMarkdownPipeline,
  MarkdownPipelineHandler,
} from "../website-pipeline-md.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { findDescriptionMd, findPreviewImgMd } from "../util/discover-meta.ts";
import { kIncludeInHeader } from "../../../../config/constants.ts";
import { sessionTempFile } from "../../../../core/temp.ts";
import { sassLayer } from "../../../../core/sass.ts";
import { kBootstrapDependencyName } from "../../../../format/html/format-html-shared.ts";
import {
  Listing,
  ListingItem,
  ListingSort,
  ListingType,
} from "./website-listing-shared.ts";
import {
  resolveItemForTemplate,
  resolveTemplateOptions,
  templateJsScript,
  templateMarkdownHandler,
  TemplateOptions,
} from "./website-listing-template.ts";

// Defaults (a card listing that contains everything
// in the source document's directory)
const kDefaultListingType = ListingType.Default;
const kDefaultContentsGlob = ["*"];
const kDefaultId = "quarto-listing";
const kSortableValueFields = ["date", "filemodified"];

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
  const listingsResolved = resolveListingContents(
    source,
    project,
    listings,
  );

  // Generate the list of items for this listing
  const listingItems: {
    listing: Listing;
    items: ListingItem[];
    options: TemplateOptions;
  }[] = [];

  for (const listingResolved of listingsResolved) {
    const listing = listingResolved.listing;
    const items: ListingItem[] = [];

    // Resolve the options
    const options = resolveTemplateOptions(listing);

    // Read the metadata for each of the listing files
    for (const input of listingResolved.files) {
      const projectRelativePath = relative(project.dir, input);
      const target = await inputTargetIndex(
        project,
        projectRelativePath,
      );

      // Create the item
      const filename = basename(projectRelativePath);
      const filemodified = fileModifiedDate(input);
      const documentMeta = target?.markdown.yaml;
      const description = documentMeta?.description as string ||
        findDescriptionMd(target?.markdown.markdown);
      const image = documentMeta?.image as string ||
        findPreviewImgMd(target?.markdown.markdown);

      const date = documentMeta?.date
        ? new Date(documentMeta.date as string)
        : filemodified;
      const author = Array.isArray(documentMeta?.author)
        ? documentMeta?.author
        : [documentMeta?.author];

      const item: ListingItem = {
        ...documentMeta,
        title: target?.title,
        date,
        author,
        image,
        description,
        path: `/${projectRelativePath}`,
        filename,
        filemodified,
        sortableValues: {},
      };

      // Resolves the item for template rendering
      resolveItemForTemplate(item, options);

      items.push(item);
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
      options,
    });
  }

  // Create and return the markdown pipeline for this set of listings
  const markdownHandlers: MarkdownPipelineHandler[] = [];
  listingItems.forEach((listingItem) => {
    markdownHandlers.push(
      markdownHandler(
        listingItem.listing,
        listingItem.items,
        listingItem.options,
      ),
    );
  });

  const pipeline = createMarkdownPipeline(
    `quarto-listing-pipeline`,
    markdownHandlers,
  );

  const kListingDependency = "quarto-listing";
  const jsPaths = [
    resourcePath("projects/website/listing/list.min.js"),
  ];
  const htmlDependencies: FormatDependency[] = [{
    name: kListingDependency,
    scripts: jsPaths.map((path) => {
      return {
        name: basename(path),
        path,
      };
    }),
  }];

  const scripts = listingItems.map((listingItem) => {
    return templateJsScript(
      listingItem.listing.id,
      listingItem.options,
      listingItem.items.length,
    );
  });

  return {
    [kIncludeInHeader]: [scriptFileForScripts(scripts)],
    [kHtmlPostprocessors]: (doc: Document) => {
      // Process the rendered listings into the document
      pipeline.processRenderedMarkdown(doc);

      // Do any other processing of the document
      listingPostProcess(doc, listings);

      return Promise.resolve([]);
    },
    [kMarkdownAfterBody]: pipeline.markdownAfterBody(),
    [kDependencies]: htmlDependencies,
    [kSassBundles]: [listingSassBundle()],
  };
}

function markdownHandler(
  listing: Listing,
  items: ListingItem[],
  templateOptions: TemplateOptions,
) {
  switch (listing.type) {
    case ListingType.Table: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-table.ejs.md",
        templateOptions,
        listing,
        items,
      );
    }
    case ListingType.Grid: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-grid.ejs.md",
        templateOptions,
        listing,
        items,
        {
          style: "--bs-gap: 1em;",
        },
      );
    }
    case ListingType.Default:
    default: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-default.ejs.md",
        templateOptions,
        listing,
        items,
      );
    }
  }
}

const kListingColumn = "column-page-left";
function listingPostProcess(doc: Document, listings: Listing[]) {
  // Move each listing to the correct column
  listings.forEach((listing) => {
    const listingDiv = doc.getElementById(listing.id);
    if (listingDiv) {
      listingDiv.classList.add(kListingColumn);
    }
  });

  // Move the title element to the correct column
  const titleEl = doc.getElementById("title-block-header");
  if (titleEl) {
    titleEl.classList.add(kListingColumn);
  }
}

function resolveListingContents(
  source: string,
  project: ProjectContext,
  listings: Listing[],
) {
  // Filter the source file out of the inputs
  const inputsWithoutSource = project.files.input.filter((file) =>
    file !== source
  );

  return listings.map((listing) => {
    // Go through the contents globs and
    // convert them to a regex and apply them
    // to the input files
    const files = filterPaths(
      dirname(source),
      inputsWithoutSource,
      listing.contents,
    );
    return {
      listing,
      files: files.include.filter((file) => !files.exclude.includes(file)),
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
      sortableValueFields: kSortableValueFields,
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
    options: meta.options as Record<string, unknown>,
    sortableValueFields: kSortableValueFields,
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
        sortableValueFields: kSortableValueFields,
      };

    case ListingType.Default:
      return {
        id: kDefaultId,
        type: ListingType.Default,
        contents: kDefaultContentsGlob,
        classes: [],
        sortableValueFields: kSortableValueFields,
      };

    case ListingType.Table:
      return {
        id: kDefaultId,
        type: ListingType.Table,
        contents: kDefaultContentsGlob,
        classes: [],
        sortableValueFields: kSortableValueFields,
      };
  }

  // Since it isn't a type of listing, treat it as a path
  return {
    id: kDefaultId,
    type: kDefaultListingType,
    contents: [val],
    classes: [],
    sortableValueFields: kSortableValueFields,
  };
}

function fileModifiedDate(input: string) {
  const file = Deno.openSync(input, { read: true });
  const fileInfo = Deno.fstatSync(file.rid);
  return fileInfo.mtime !== null ? fileInfo.mtime : undefined;
}

function scriptFileForScripts(scripts: string[]) {
  const scriptFile = sessionTempFile({ suffix: ".html" });
  const contents = `<script>\n${scripts.join("\n")}</script>`;
  Deno.writeTextFileSync(scriptFile, contents);
  return scriptFile;
}

export function listingSassBundle() {
  const scssPath = resourcePath("projects/website/listing/quarto-listing.scss");
  const layer = sassLayer(scssPath);
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      name: "quarto-listing.css",
      ...layer,
    },
  };
}
