/*
* website-listing-resolve.ts
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { warning } from "log/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";
import { cloneDeep, orderBy } from "../../../../core/lodash.ts";
import { existsSync } from "fs/mod.ts";

import { Format, Metadata } from "../../../../config/types.ts";
import {
  filterPaths,
  pathWithForwardSlashes,
  resolvePathGlobs,
} from "../../../../core/path.ts";
import {
  inputTargetIndex,
  resolveInputTarget,
} from "../../../project-index.ts";
import { ProjectContext } from "../../../types.ts";

import {
  estimateReadingTimeMinutes,
  findPreviewImgMd,
} from "../util/discover-meta.ts";
import {
  ColumnType,
  kCategoryStyle,
  kFeed,
  kFieldAuthor,
  kFieldCategories,
  kFieldDate,
  kFieldDescription,
  kFieldDisplayNames,
  kFieldFileModified,
  kFieldFileName,
  kFieldFilter,
  kFieldImage,
  kFieldImageAlt,
  kFieldLinks,
  kFieldReadingTime,
  kFieldRequired,
  kFieldSort,
  kFieldSubtitle,
  kFieldTitle,
  kFieldTypes,
  kFilterUi,
  kGridColumns,
  kImageAlign,
  kImageAlt,
  kImageHeight,
  kListing,
  kMaxDescLength,
  kPageSize,
  kSortAsc,
  kSortDesc,
  kSortUi,
  kTableHover,
  kTableStriped,
  Listing,
  ListingDehydrated,
  ListingDescriptor,
  ListingFeedOptions,
  ListingItem,
  ListingItemSource,
  ListingSharedOptions,
  ListingSort,
  ListingType,
  renderedContentReader,
} from "./website-listing-shared.ts";
import {
  kListingPageFieldAuthor,
  kListingPageFieldCategories,
  kListingPageFieldDate,
  kListingPageFieldDescription,
  kListingPageFieldFileModified,
  kListingPageFieldFileName,
  kListingPageFieldReadingTime,
  kListingPageFieldSubtitle,
  kListingPageFieldTitle,
} from "../../../../config/constants.ts";
import { isAbsoluteRef } from "../../../../core/http.ts";
import { isYamlPath, readYaml } from "../../../../core/yaml.ts";
import { parseAuthor } from "../../../../core/author.ts";
import { parsePandocDate, resolveDate } from "../../../../core/date.ts";
import { ProjectOutputFile } from "../../types.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { directoryMetadataForInputFile } from "../../../project-context.ts";
import { mergeConfigs } from "../../../../core/config.ts";

// Defaults (a card listing that contains everything
// in the source document's directory)
const kDefaultListingType = ListingType.Default;
const kDefaultContentsGlob = ["*"];
const kDefaultId = "listing";
const kDefaultTableFields = [
  kFieldDate,
  kFieldTitle,
  kFieldAuthor,
];
const kDefaultGridFields = [
  kFieldTitle,
  kFieldAuthor,
  kFieldDate,
  kFieldImage,
  kFieldDescription,
];
const kDefaultFields = [
  kFieldDate,
  kFieldTitle,
  kFieldAuthor,
  kFieldSubtitle,
  kFieldImage,
  kFieldDescription,
];

const defaultFieldDisplayNames = (format: Format) => {
  return {
    [kFieldImage]: " ",
    [kFieldDate]: format.language[kListingPageFieldDate] || "",
    [kFieldTitle]: format.language[kListingPageFieldTitle] || "",
    [kFieldDescription]: format.language[kListingPageFieldDescription] || "",
    [kFieldAuthor]: format.language[kListingPageFieldAuthor] || "",
    [kFieldFileName]: format.language[kListingPageFieldFileName] || "",
    [kFieldFileModified]: format.language[kListingPageFieldFileModified] || "",
    [kFieldSubtitle]: format.language[kListingPageFieldSubtitle] || "",
    [kFieldReadingTime]: format.language[kListingPageFieldReadingTime] || "",
    [kFieldCategories]: format.language[kListingPageFieldCategories] || "",
  };
};

const kDefaultFieldTypes: Record<string, ColumnType> = {
  [kFieldDate]: "date",
  [kFieldFileModified]: "date",
  [kFieldReadingTime]: "minutes",
};
const kDefaultFieldLinks = [kFieldTitle, kFieldFileName];

const kDefaultFieldSort = [
  kFieldTitle,
  kFieldDate,
  kFieldAuthor,
  kFieldFileName,
  kFieldFileModified,
];

const kDefaultFieldRequired: string[] = [];

export async function readListings(
  source: string,
  project: ProjectContext,
  format: Format,
): Promise<
  { listingDescriptors: ListingDescriptor[]; options: ListingSharedOptions }
> {
  // The listings and items for this source
  const listingItems: ListingDescriptor[] = [];

  // Read listing data from document metadata
  const listings = readDehydratedListings(source, format);

  // Read any global properties from the listings
  const firstListingValue = (key: string, defaultValue?: unknown) => {
    for (const listing of listings) {
      const value = listing[key];
      if (value !== undefined) {
        return value;
      }
    }
    return defaultValue;
  };

  // Process categories
  const categories = firstListingValue(kFieldCategories, false);

  const parseCategoryStyle = (categories: unknown) => {
    if (typeof (categories) === "string") {
      switch (categories) {
        case "unnumbered":
          return "category-unnumbered";
        case "cloud":
          return "category-cloud";
        default:
        case "default":
          return "category-default";
      }
    } else {
      return "category-default";
    }
  };
  const categoryStyle = parseCategoryStyle(categories);

  const sharedOptions: ListingSharedOptions = {
    [kFieldCategories]: !!categories,
    [kCategoryStyle]: categoryStyle,
  };

  const feed = firstListingValue(kFeed, undefined);
  if (feed !== undefined) {
    if (typeof (feed) === "object") {
      // If is an object, forward it along
      sharedOptions[kFeed] = feed as ListingFeedOptions;
    } else if (feed) {
      // If its truthy, forward the default feed
      sharedOptions[kFeed] = {
        type: "full",
      };
    }
  }

  for (const listing of listings) {
    // Read the metadata for each of the listing files
    const { items, sources } = await readContents(source, project, listing);

    // Hydrate the listing
    const listingHydrated = hydrateListing(
      format,
      listing,
      items,
      sources,
      sharedOptions,
    );

    // Sort the items (first array is of sort functions)
    // second array is of sort direction
    const sortedAndFiltered = (
      listing: Listing,
      items: ListingItem[],
    ): ListingItem[] => {
      if (listing.sort && listing.sort.length > 0) {
        return orderBy(
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
    const orderedItems = sortedAndFiltered(listingHydrated, items);

    // Add this listing and its items to the list
    listingItems.push({
      listing: listingHydrated,
      items: orderedItems,
    });
  }
  return { listingDescriptors: listingItems, options: sharedOptions };
}

export function completeListingDescriptions(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  _incremental: boolean,
) {
  const contentReader = renderedContentReader(context, false);

  // Go through any output files and fix up any feeds associated with them
  outputFiles.forEach((outputFile) => {
    // Does this output file contain a listing?
    if (outputFile.format.metadata[kListing]) {
      // Read the listing page
      let fileContents = Deno.readTextFileSync(outputFile.file);

      // Use a regex to identify any placeholders
      const regex = descriptionPlaceholderRegex;
      regex.lastIndex = 0;
      let match = regex.exec(fileContents);
      while (match) {
        // For each placeholder, get its target href, then read the contents of that
        // file and inject the contents.
        const relativePath = match[1];
        const absolutePath = join(projectOutputDir(context), relativePath);
        const placeholder = descriptionPlaceholder(relativePath);
        if (existsSync(absolutePath)) {
          const contents = contentReader(absolutePath);
          fileContents = fileContents.replace(
            placeholder,
            contents.firstPara || "",
          );
        } else {
          fileContents = fileContents.replace(
            placeholder,
            "",
          );
          warning(
            `Unable to read listing item description from ${relativePath}`,
          );
        }
        match = regex.exec(fileContents);
      }
      regex.lastIndex = 0;
      Deno.writeTextFileSync(
        outputFile.file,
        fileContents,
      );
    }
  });
}

function descriptionPlaceholder(file?: string): string {
  return file ? `<!-- desc(5A0113B34292):${file} -->` : "";
}

const descriptionPlaceholderRegex = /<!-- desc\(5A0113B34292\):(.*) -->/;

function hydrateListing(
  format: Format,
  listing: ListingDehydrated,
  items: ListingItem[],
  sources: Set<ListingItemSource>,
  options: ListingSharedOptions,
): Listing {
  const fieldsForItems = (items: ListingItem[]): string[] => {
    const unionedItem = items.reduce((prev, current) => {
      const item = { ...prev };
      for (const key of Object.keys(current)) {
        if (current[key] !== undefined) {
          item[key] = current[key];
        }
      }
      return item;
    }, {});
    return Object.keys(unionedItem).filter((key) => {
      return unionedItem[key] !== undefined;
    });
  };

  const itemFields = fieldsForItems(items);

  const suggestFields = (
    type: ListingType,
    itemFields: string[],
  ): string[] => {
    if (sources.size === 1 && sources.has(ListingItemSource.rawfile)) {
      // If all the items are raw files, we should just show file info
      return [kFieldFileName, kFieldFileModified];
    } else if (sources.has(ListingItemSource.metadata)) {
      // If the items have come from metadata, we should just show
      // all the columns in the table. Otherwise, we should use the
      // document default columns
      return itemFields;
    } else {
      return defaultFields(type, itemFields);
    }
  };

  const suggestedFields = suggestFields(listing.type, itemFields);

  // Don't include fields that the items don't have
  const fields = suggestedFields.filter((field) => {
    return itemFields.includes(field);
  });
  const finalFields = fields.length > 0 ? fields : itemFields;

  // Sorting and linking are only available in built in templates
  // right now, so don't expose these fields defaults in custom
  const defaultSort =
    listing.type !== ListingType.Custom && listing.type !== ListingType.Table
      ? kDefaultFieldSort
      : suggestedFields;
  const defaultLinks = listing.type === ListingType.Table
    ? kDefaultFieldLinks
    : [];

  const defaultPageSize = () => {
    switch (listing.type) {
      case ListingType.Table:
        return 30;
      case ListingType.Grid:
        return 18;
      default:
      case ListingType.Default:
        return 25;
    }
  };

  const hydratedFields = [...finalFields];
  if (
    options[kFieldCategories] &&
    (listing.type === ListingType.Grid || listing.type === ListingType.Default)
  ) {
    if (!hydratedFields.includes(kFieldCategories)) {
      hydratedFields.push(kFieldCategories);
    }
  }

  const listingHydrated: Listing = cloneDeep({
    fields: hydratedFields,
    [kFieldDisplayNames]: {},
    [kFieldTypes]: kDefaultFieldTypes,
    [kFieldLinks]: defaultLinks,
    [kFieldSort]: defaultSort,
    [kFieldFilter]: hydratedFields,
    [kFieldRequired]: kDefaultFieldRequired,
    [kPageSize]: defaultPageSize(),
    [kFilterUi]: listing[kFilterUi] !== undefined
      ? listing[kFilterUi]
      : listing.type === ListingType.Table,
    [kSortUi]: listing[kSortUi] !== undefined
      ? listing[kSortUi]
      : listing.type === ListingType.Table,
    ...listing,
  });

  // Apply a default sort if the title field is present and the sources contain documents
  const sort: ListingSort[] | undefined = hydratedFields.includes(kFieldTitle)
    ? [{ field: "title", direction: "asc" }]
    : undefined;
  if (
    sort && !listingHydrated.sort && sources.has(ListingItemSource.document)
  ) {
    listingHydrated.sort = sort;
  }

  // TODO: If the user requests to sort by field that doesn't exist
  // throw an error (and provide a helpful message)

  // Forward fields if listed in sort UI or Filter UI
  const sortUi = listingHydrated[kSortUi];
  if (sortUi && Array.isArray(sortUi)) {
    listingHydrated[kFieldSort] = sortUi;
  }

  const filterUi = listingHydrated[kFilterUi];
  if (filterUi && Array.isArray(filterUi)) {
    listingHydrated[kFieldFilter] = filterUi;
  }

  // Populate base default values for types
  if (listing.type === ListingType.Grid) {
    listingHydrated[kGridColumns] = listingHydrated[kGridColumns] || 3;
    listingHydrated[kImageHeight] = listingHydrated[kImageHeight] || "150px";
    listingHydrated[kMaxDescLength] = listingHydrated[kMaxDescLength] || 175;
  } else if (listing.type === ListingType.Default) {
    listingHydrated[kImageAlign] = listingHydrated[kImageAlign] || "right";
  } else if (listing.type === ListingType.Table) {
    listingHydrated[kImageHeight] = listingHydrated[kImageHeight] || "40px";
    listingHydrated[kTableStriped] =
      listingHydrated[kTableStriped] !== undefined
        ? listingHydrated[kTableStriped]
        : false;
    listingHydrated[kTableHover] = listingHydrated[kTableHover] !== undefined
      ? listingHydrated[kTableHover]
      : false;
  }

  // Merge column types
  listingHydrated[kFieldTypes] = {
    ...listingHydrated[kFieldTypes],
    ...listing[kFieldTypes] as Record<string, ColumnType>,
  };

  // Merge display names
  listingHydrated[kFieldDisplayNames] = {
    ...defaultFieldDisplayNames(format),
    ...listing[kFieldDisplayNames] as Record<string, string>,
  };

  return listingHydrated;
}

async function readContents(
  source: string,
  project: ProjectContext,
  listing: ListingDehydrated,
) {
  const listingItems: ListingItem[] = [];
  const listingItemSources = new Set<ListingItemSource>();

  // Accumulate the files that would be allowed to be included
  // This will include:
  //   - project input files
  const inputsWithoutSource = project.files.input.filter((file) =>
    file !== source
  );

  const filterListingFiles = (globOrPath: string) => {
    // Convert a bare directory path into a consumer
    // of everything in the directory
    const expanded = expandGlob(source, project, globOrPath);
    if (expanded.inputs) {
      // If this is a glob, expand it
      return filterPaths(
        dirname(source),
        inputsWithoutSource,
        [expanded.glob],
      );
    } else {
      return resolvePathGlobs(
        dirname(source),
        [expanded.glob],
        ["_*", ".*", "**/_*", "**/.*", source],
      );
    }
  };

  for (const content of listing.contents) {
    if (typeof (content) === "string") {
      // Find the files we should use based upon this glob or path

      const files = filterListingFiles(content);

      for (const file of files.include) {
        if (!files.exclude.includes(file)) {
          if (isYamlPath(file)) {
            const yaml = readYaml(file);
            if (Array.isArray(yaml)) {
              const items = yaml as Array<unknown>;
              items.forEach((item) => {
                if (typeof (item) === "object") {
                  const listingItem = listItemFromMeta(item as Metadata);
                  validateItem(listing, listingItem, (field: string) => {
                    return `An item from the file '${file}' is missing the required field '${field}'.`;
                  });
                  listingItemSources.add(ListingItemSource.metadata);
                  listingItems.push(listingItem);
                } else {
                  throw new Error(
                    `Unexpected listing contents in file ${file}. The array may only contain listing items, not paths or other types of data.`,
                  );
                }
              });
            } else if (typeof (yaml) === "object") {
              const listingItem = listItemFromMeta(yaml as Metadata);
              validateItem(listing, listingItem, (field: string) => {
                return `The item defined in file '${file}' is missing the required field '${field}'.`;
              });
              listingItemSources.add(ListingItemSource.metadata);
              listingItems.push(listingItem);
            } else {
              throw new Error(
                `Unexpected listing contents in file ${file}. The file should contain only one more listing items.`,
              );
            }
          } else {
            const item = await listItemFromFile(file, project);
            if (item) {
              validateItem(listing, item, (field: string) => {
                return `The file ${file} is missing the required field '${field}'.`;
              });
              listingItemSources.add(item.source);
              listingItems.push(item.item);
            }
          }
        }
      }
    } else {
      const listingItem = listItemFromMeta(content);
      validateItem(listing, listingItem, (field: string) => {
        return `An item in the listing '${listing.id}' is missing the required field '${field}'.`;
      });
      listingItemSources.add(ListingItemSource.metadata);
      listingItems.push(listingItem);
    }
  }

  return {
    items: listingItems,
    sources: listingItemSources,
  };
}

// Validates that items have all the required fields
function validateItem(
  listing: ListingDehydrated,
  item: ListingItem,
  message: (field: string) => string,
) {
  const requiredFields = (listing: ListingDehydrated) => {
    const fields = listing[kFieldRequired];
    if (fields) {
      if (Array.isArray(fields)) {
        return fields;
      } else {
        return [fields];
      }
    } else {
      return undefined;
    }
  };

  const validationFields = requiredFields(listing);
  if (validationFields) {
    validationFields.forEach((requiredField: string) => {
      if (item[requiredField] === undefined) {
        throw new Error(message(requiredField));
      }
    });
  }
}

function listItemFromMeta(meta: Metadata) {
  const listingItem = cloneDeep(meta);

  // If there is a path, try to complete the filename and
  // modified values
  if (meta.path !== undefined) {
    meta[kFieldFileName] = basename(meta.path as string);
    meta[kFieldFileModified] = fileModifiedDate(meta.path as string);
  }

  if (meta.author) {
    if (!Array.isArray(meta.author)) {
      meta.author = [meta.author];
    }
  }
  return listingItem;
}

async function listItemFromFile(input: string, project: ProjectContext) {
  const projectRelativePath = relative(project.dir, input);
  const target = await inputTargetIndex(
    project,
    projectRelativePath,
  );
  const inputTarget = await resolveInputTarget(
    project,
    projectRelativePath,
    false,
  );

  const docRawMetadata = target?.markdown.yaml;
  const directoryMetadata = directoryMetadataForInputFile(
    project,
    dirname(input),
  );
  const documentMeta = await mergeConfigs(
    directoryMetadata,
    docRawMetadata,
  ) as Metadata;

  if (documentMeta?.draft) {
    // This is a draft, don't include it in the listing
    return undefined;
  } else {
    // Create the item
    const filename = basename(projectRelativePath);
    const filemodified = fileModifiedDate(input);
    const description = documentMeta?.description as string ||
      documentMeta?.abstract as string ||
      descriptionPlaceholder(inputTarget?.outputHref);

    const imageRaw = documentMeta?.image as string ||
      findPreviewImgMd(target?.markdown.markdown);
    const image = imageRaw !== undefined
      ? pathWithForwardSlashes(
        listingItemHref(imageRaw, dirname(projectRelativePath)),
      )
      : undefined;

    const imageAlt = documentMeta?.[kImageAlt] as string | undefined;

    const date = documentMeta?.date
      ? parsePandocDate(resolveDate(input, documentMeta?.date) as string)
      : undefined;

    const authors = parseAuthor(documentMeta?.author);
    const author = authors ? authors.map((auth) => auth.name) : [];

    const readingtime = target?.markdown
      ? estimateReadingTimeMinutes(target.markdown.markdown)
      : undefined;

    const categories = documentMeta?.categories
      ? Array.isArray(documentMeta?.categories)
        ? documentMeta?.categories
        : [documentMeta?.categories]
      : undefined;

    const item: ListingItem = {
      ...documentMeta,
      path: `/${projectRelativePath}`,
      [kFieldTitle]: target?.title,
      [kFieldDate]: date,
      [kFieldAuthor]: author,
      [kFieldCategories]: categories,
      [kFieldImage]: image,
      [kFieldImageAlt]: imageAlt,
      [kFieldDescription]: description,
      [kFieldFileName]: filename,
      [kFieldFileModified]: filemodified,
      [kFieldReadingTime]: readingtime,
    };
    return {
      item,
      source: target !== undefined
        ? ListingItemSource.document
        : ListingItemSource.rawfile,
    };
  }
}

// Processes the 'listing' metadata into an
// array of Listings to be processed
function readDehydratedListings(
  source: string,
  format: Format,
): ListingDehydrated[] {
  const listingConfig = format.metadata[kListing];
  const listings: ListingDehydrated[] = [];
  if (typeof (listingConfig) == "string") {
    // Resolve this string
    const listing = listingForType(listingType(listingConfig));
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
      return listingForMetadata(
        listing,
        () => {
          count = count + 1;
          return `${kDefaultId}-${count}`;
        },
        source,
      );
    }));
  } else if (listingConfig && typeof (listingConfig) === "object") {
    // Process an individual listing
    listings.push(
      listingForMetadata(
        listingConfig as Record<string, unknown>,
        () => {
          return kDefaultId;
        },
        source,
      ),
    );
  } else if (listingConfig) {
    // Process a boolean that is true
    listings.push(listingForType(ListingType.Default));
  }

  return listings;
}

function listingForMetadata(
  meta: Record<string, unknown>,
  synthId: () => string,
  source: string,
): ListingDehydrated {
  // Create a default listing
  const listingType = meta.type as ListingType || kDefaultListingType;
  const baseListing = listingForType(listingType);

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
  listing.sort = computeListingSort(meta.sort);

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

function computeListingSort(rawValue: unknown): ListingSort[] | undefined {
  const parseValue = (sortValue: unknown): ListingSort | undefined => {
    if (sortValue == undefined) {
      return undefined;
    }

    if (typeof (sortValue) === "string") {
      const sortStr = sortValue as string;
      const parts = sortStr.split(" ");
      if (parts.length === 2) {
        return {
          field: parts[0],
          direction: parts[1] === kSortAsc ? kSortAsc : kSortDesc,
        };
      } else {
        return {
          field: parts[0],
          direction: kSortAsc,
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

function defaultFields(type: ListingType, itemFields: string[]) {
  switch (type) {
    case ListingType.Grid:
      return kDefaultGridFields;
    case ListingType.Table:
      return kDefaultTableFields;
    case ListingType.Custom:
      return itemFields;
    case ListingType.Default:
    default:
      return kDefaultFields;
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

function listingForType(
  type: ListingType,
): ListingDehydrated {
  const listing: ListingDehydrated = {
    id: kDefaultId,
    type: type,
    contents: kDefaultContentsGlob,
  };
  return listing;
}

function fileModifiedDate(input: string) {
  if (existsSync(input)) {
    const fileInfo = Deno.statSync(input);
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
    // to be project relative
    return join("/", projectRelativePath, path);
  }
}

function expandGlob(
  source: string,
  project: ProjectContext,
  globOrPath: string,
) {
  const getPath = () => {
    if (globOrPath.startsWith("/")) {
      return join(project.dir, globOrPath);
    } else {
      const sourcePath = dirname(source);
      return join(sourcePath, globOrPath);
    }
  };

  // If the glob resolves to a directory, we will
  // interpret this as meaning that we should glob _inputs_
  // from that directory (rather than all files, for example)
  //
  // If the glob resolves to a non-directory path
  // we will treat it as globbing against the file system,
  // not limiting itself to considering project inputs
  const globOrPathAsPath = getPath();
  try {
    if (Deno.statSync(globOrPathAsPath).isDirectory) {
      return { glob: join(globOrPath, "**"), inputs: true };
    } else {
      return { glob: globOrPath, inputs: false };
    }
  } catch {
    return { glob: globOrPath, inputs: false };
  }
}
