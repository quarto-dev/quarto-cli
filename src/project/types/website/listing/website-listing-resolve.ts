/*
* website-listing-resolve.ts
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, join, relative } from "path/mod.ts";
import { ld } from "lodash/mod.ts";
import { existsSync } from "fs/mod.ts";

import { Format, Metadata } from "../../../../config/types.ts";
import { filterPaths } from "../../../../core/path.ts";
import { inputTargetIndex } from "../../../project-index.ts";
import { ProjectContext } from "../../../types.ts";

import { findDescriptionMd, findPreviewImgMd } from "../util/discover-meta.ts";
import {
  ColumnType,
  kColumnCount,
  kColumnLinks,
  kColumnNames,
  kColumnSort,
  kColumnTypes,
  kImageAlign,
  kImageHeight,
  kRowCount,
  kShowFilter,
  kShowSort,
  Listing,
  ListingItem,
  ListingSort,
  ListingType,
  ResolvedListing,
} from "./website-listing-shared.ts";
import {
  kListingPageColumnAuthor,
  kListingPageColumnDate,
  kListingPageColumnDescription,
  kListingPageColumnFileModified,
  kListingPageColumnFileName,
  kListingPageColumnSubtitle,
  kListingPageColumnTitle,
} from "../../../../config/constants.ts";
import { isAbsoluteRef } from "../../../../core/http.ts";
import { isYamlPath, readYaml } from "../../../../core/yaml.ts";
import { projectYamlFiles } from "../../../project-context.ts";

// The root listing key
export const kListing = "listing";

// Defaults (a card listing that contains everything
// in the source document's directory)
const kDefaultListingType = ListingType.Default;
const kDefaultContentsGlob = ["*"];
const kDefaultId = "quarto-listing";
const kDefaultTableColumns = ["date", "title", "author", "filename"];
const kDefaultGridColumns = [
  "title",
  "subtitle",
  "author",
  "image",
  "description",
  "filename",
  "filemodified",
];
const kDefaultColumns = [
  "date",
  "title",
  "author",
  "subtitle",
  "image",
  "description",
];

const defaultColumnNames = (format: Format) => {
  return {
    "image": " ",
    "date": format.language[kListingPageColumnDate] || "",
    "title": format.language[kListingPageColumnTitle] || "",
    "description": format.language[kListingPageColumnDescription] || "",
    "author": format.language[kListingPageColumnAuthor] || "",
    "filename": format.language[kListingPageColumnFileName] || "",
    "filemodified": format.language[kListingPageColumnFileModified] || "",
    "subtitle": format.language[kListingPageColumnSubtitle] || "",
  };
};

const kDefaultColumnTypes: Record<string, ColumnType> = {
  "date": "date",
  "filemodified": "date",
};
const kDefaultColumnLinks = ["title", "filename"];

const kDefaultColumnSort = [
  "title",
  "date",
  "author",
  "filename",
  "filemodified",
];

export async function resolveListings(
  source: string,
  project: ProjectContext,
  format: Format,
): Promise<ResolvedListing[]> {
  // The listings and items for this source
  const listingItems: ResolvedListing[] = [];

  // Read listing data from document metadata
  const listings = readListings(source, format);

  for (const listing of listings) {
    // Read the metadata for each of the listing files
    const items = await resolveContents(source, project, listing);

    // Sort the items (first array is of sort functions)
    // second array is of sort direction
    const sortedAndFiltered = (): ListingItem[] => {
      if (listing.sort && listing.sort.length > 0) {
        return ld.orderBy(
          items,
          listing.sort.map((l) => {
            return (item: ListingItem) => {
              return item[l.column];
            };
          }),
          listing.sort.map((l) => l.direction),
        );
      } else {
        return items;
      }
    };
    const orderedItems = sortedAndFiltered();

    // Add this listing and its items to the list
    listingItems.push({
      listing,
      items: orderedItems,
    });
  }
  return listingItems;
}

async function resolveContents(
  source: string,
  project: ProjectContext,
  listing: Listing,
) {
  const listingItems: ListingItem[] = [];

  // Accumulate the files that would be allowed to be included
  // This will include:
  //   - project input files
  const inputsWithoutSource = project.files.input.filter((file) =>
    file !== source
  );
  //   - YAML files in the source directory or a child directory
  const yamlFiles: string[] = projectYamlFiles(dirname(source));
  const possibleListingFiles = [
    ...inputsWithoutSource,
    ...yamlFiles,
  ];

  for (const content of listing.contents) {
    if (typeof (content) === "string") {
      // This is a path (glob)-  compare itw
      const files = filterPaths(
        dirname(source),
        possibleListingFiles,
        [content],
      );

      for (const file of files.include) {
        if (!files.exclude.includes(file)) {
          if (isYamlPath(file)) {
            const yaml = readYaml(file);
            if (Array.isArray(yaml)) {
              const items = yaml as Array<unknown>;
              items.forEach((item) => {
                if (typeof (item) === "object") {
                  const listingItem = listItemFromMeta(item as Metadata);
                  listingItems.push(listingItem);
                } else {
                  throw new Error(
                    `Unexpected listing contents in file ${file}. The array may only contain listing items, not paths or other types of data.`,
                  );
                }
              });
            } else if (typeof (yaml) === "object") {
              const listingItem = listItemFromMeta(yaml as Metadata);
              listingItems.push(listingItem);
            } else {
              throw new Error(
                `Unexpected listing contents in file ${file}. The file should contain only one more listing items.`,
              );
            }
          } else {
            const item = await listItemFromFile(file, project);
            listingItems.push(item);
          }
        }
      }
    } else {
      const listingItem = listItemFromMeta(content);
      listingItems.push(listingItem);
    }
  }
  return listingItems;
}

function listItemFromMeta(meta: Metadata) {
  // This is a raw item object, adapt any typed values...
  const date = meta?.date ? new Date(meta.date as string) : undefined;
  const author = meta.author !== undefined
    ? Array.isArray(meta?.author) ? meta?.author : [meta?.author]
    : undefined;

  // If there is a path, try to complete the filename and
  // modified values
  const filename = meta?.path !== undefined
    ? basename(meta.path as string)
    : undefined;
  const filemodified = meta?.path !== undefined
    ? fileModifiedDate(meta.path as string)
    : undefined;

  return {
    ...meta,
    date,
    author,
    filename,
    filemodified,
  };
}

async function listItemFromFile(input: string, project: ProjectContext) {
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
  const imageRaw = documentMeta?.image as string ||
    findPreviewImgMd(target?.markdown.markdown);
  const image = imageRaw !== undefined
    ? listingItemHref(imageRaw, dirname(projectRelativePath))
    : undefined;

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
  return item;
}

// Processes the 'listing' metadata into an
// array of Listings to be processed
function readListings(
  source: string,
  format: Format,
): Listing[] {
  const listingConfig = format.metadata[kListing];
  const listings: Listing[] = [];
  if (typeof (listingConfig) == "string") {
    // Resolve this string
    const listing = resolveListingType(listingType(listingConfig), format);
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
      return resolveListing(
        listing,
        () => {
          count = count + 1;
          return `${kDefaultId}-${count}`;
        },
        source,
        format,
      );
    }));
  } else if (listingConfig && typeof (listingConfig) === "object") {
    // Process an individual listing
    listings.push(
      resolveListing(
        listingConfig as Record<string, unknown>,
        () => {
          return kDefaultId;
        },
        source,
        format,
      ),
    );
  } else if (listingConfig) {
    // Process a boolean that is true
    listings.push(resolveListingType(ListingType.Default, format));
  }

  return listings;
}

function resolveListing(
  meta: Record<string, unknown>,
  synthId: () => string,
  source: string,
  format: Format,
): Listing {
  // Create a default listing
  const listingType = meta.type as ListingType || kDefaultListingType;
  const baseListing = resolveListingType(listingType, format);

  const ensureArray = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val as string[];
    } else {
      return [val] as string[];
    }
  };

  // Create the base listing by simply merging the
  // default listing with the users configuration of a listing
  const listing = {
    ...baseListing,
    ...meta,
  };

  // Go through and specifically merge fields that require
  // special behavior

  // Use the userId or our synthesized Id
  listing.id = meta.id as string || synthId();

  // Set the sort to our resolve listing (if the user has provided it)
  // If the user hasn't provided a sort, the list will be unsorted
  // following the order provided in the listing contents
  listing.sort = resolveListingSort(meta.sort);

  // Merge column types
  listing[kColumnTypes] = {
    ...baseListing[kColumnTypes],
    ...meta[kColumnTypes] as Record<string, ColumnType>,
  };

  // Coerce contents to an array
  if (meta.contents) {
    listing.contents = ensureArray(meta.contents);
  }

  // If a template is provided, this must be custom
  if (meta.template && typeof (meta.template) === "string") {
    listing.type = ListingType.Custom;
    listing.template = join(dirname(source), meta.template);
  }
  return listing;
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
      return key;
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
          column: toSortKey(parts[0]),
          direction: parts[1] === "asc" ? "asc" : "desc",
        };
      } else {
        return {
          column: toSortKey(parts[0]),
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

function defaultColumns(type: ListingType) {
  switch (type) {
    case ListingType.Grid:
      return kDefaultGridColumns;
    case ListingType.Table:
      return kDefaultTableColumns;
    case ListingType.Default:
    default:
      return kDefaultColumns;
  }
}

function listingType(val: unknown): ListingType {
  switch (val) {
    case ListingType.Grid:
    case ListingType.Default:
    case ListingType.Table:
      return val as ListingType;
    default:
      return ListingType.Default;
  }
}

function resolveListingType(type: ListingType, format: Format): Listing {
  const listing: Listing = {
    id: kDefaultId,
    type: type,
    contents: kDefaultContentsGlob,
    columns: defaultColumns(type),
    [kColumnNames]: defaultColumnNames(format),
    [kColumnTypes]: kDefaultColumnTypes,
    [kColumnLinks]: kDefaultColumnLinks,
    [kColumnSort]: kDefaultColumnSort,
    [kRowCount]: 100,
    [kShowFilter]: true,
    [kShowSort]: true,
  };

  // Populate base default values for types
  if (type === ListingType.Grid) {
    listing[kColumnCount] = 2;
    listing[kImageHeight] = 120;
  } else if (type === ListingType.Default) {
    listing[kImageAlign] = "right";
  }

  return listing;
}

function fileModifiedDate(input: string) {
  if (existsSync(input)) {
    const file = Deno.openSync(input, { read: true });
    const fileInfo = Deno.fstatSync(file.rid);
    return fileInfo.mtime !== null ? fileInfo.mtime : undefined;
  } else {
    return undefined;
  }
}

function listingItemHref(path: string, projectRelativePath: string) {
  if (isAbsoluteRef(path) || path.startsWith("/")) {
    // This is a project relative or absolute href, just
    // leave it alone
    return path;
  } else {
    // This is a document relative path, need to fix it up
    return join(projectRelativePath, path);
  }
}
