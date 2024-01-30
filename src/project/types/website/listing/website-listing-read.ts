/*
* website-listing-resolve.ts
.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { debug, warning } from "log/mod.ts";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "path/mod.ts";
import { cloneDeep, orderBy } from "../../../../core/lodash.ts";
import { existsSync } from "fs/mod.ts";

import { Format, Metadata } from "../../../../config/types.ts";
import {
  filterPaths,
  pathWithForwardSlashes,
  resolvePathGlobs,
  safeExistsSync,
} from "../../../../core/path.ts";
import {
  inputTargetIndex,
  resolveInputTarget,
} from "../../../project-index.ts";
import { ProjectContext } from "../../../types.ts";

import { estimateReadingTimeMinutes } from "../util/discover-meta.ts";
import {
  ColumnType,
  kCategoryStyle,
  kDefaultMaxDescLength,
  kExclude,
  kFeed,
  kFieldAuthor,
  kFieldCategories,
  kFieldDate,
  kFieldDateModified,
  kFieldDescription,
  kFieldDisplayNames,
  kFieldFileModified,
  kFieldFileName,
  kFieldFilter,
  kFieldImage,
  kFieldImageAlt,
  kFieldLinks,
  kFieldOrder,
  kFieldReadingTime,
  kFieldRequired,
  kFieldSort,
  kFieldSubtitle,
  kFieldTitle,
  kFieldTypes,
  kFieldWordCount,
  kFilterUi,
  kGridColumns,
  kImageAlign,
  kImageAlt,
  kImageHeight,
  kImagePlaceholder,
  kInclude,
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
  PreviewImage,
  renderedContentReader,
} from "./website-listing-shared.ts";
import {
  kDateModified,
  kListingPageFieldAuthor,
  kListingPageFieldCategories,
  kListingPageFieldDate,
  kListingPageFieldDescription,
  kListingPageFieldFileModified,
  kListingPageFieldFileName,
  kListingPageFieldReadingTime,
  kListingPageFieldSubtitle,
  kListingPageFieldTitle,
  kListingPageFieldWordCount,
} from "../../../../config/constants.ts";
import { isAbsoluteRef } from "../../../../core/http.ts";
import { isYamlPath, readYaml } from "../../../../core/yaml.ts";
import { parseAuthor } from "../../../../core/author.ts";
import { parsePandocDate, resolveDate } from "../../../../core/date.ts";
import { ProjectOutputFile } from "../../types.ts";
import {
  directoryMetadataForInputFile,
  projectOutputDir,
} from "../../../project-shared.ts";
import { mergeConfigs } from "../../../../core/config.ts";
import { globToRegExp } from "https://deno.land/std@0.204.0/path/glob.ts";
import { cslNames } from "../../../../core/csl.ts";
import { isHttpUrl } from "../../../../core/url.ts";
import { InternalError } from "../../../../core/lib/error.ts";
import { isHtmlOutput } from "../../../../config/format.ts";

// Defaults (a card listing that contains everything
// in the source document's directory)
const kDefaultListingType = ListingType.Default;
const kDefaultContentsGlobToken = "B3049D40";
const kDefaultContentsGlob = [kDefaultContentsGlobToken];
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
    [kFieldDateModified]: format.language[kListingPageFieldFileModified] || "",
    [kFieldFileModified]: format.language[kListingPageFieldFileModified] || "",
    [kFieldSubtitle]: format.language[kListingPageFieldSubtitle] || "",
    [kFieldReadingTime]: format.language[kListingPageFieldReadingTime] || "",
    [kFieldWordCount]: format.language[kListingPageFieldWordCount] || "",
    [kFieldCategories]: format.language[kListingPageFieldCategories] || "",
  };
};

const kDefaultFieldTypes: Record<string, ColumnType> = {
  [kFieldDate]: "date",
  [kFieldFileModified]: "date",
  [kFieldDateModified]: "date",
  [kFieldReadingTime]: "minutes",
  [kFieldWordCount]: "number",
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
    if (typeof categories === "string") {
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
    if (typeof feed === "object") {
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
              // handle undefined for 'order' (it's used by our default)
              const value = item[l.field];
              if (value === undefined && l.field === kFieldOrder) {
                if (l.direction === "asc") {
                  return Number.MAX_SAFE_INTEGER;
                } else {
                  return 0;
                }
              } else {
                return value;
              }
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

export function completeListingItems(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  _incremental: boolean,
) {
  debug(`[listing] Completing listing items for ${outputFiles.length} files`);
  const options = {
    remove: { links: true, images: true },
  };

  debug(`[listing] Creating content reader`);
  const contentReader = renderedContentReader(context, options);

  // Go through any output files and fix up any feeds associated with them
  outputFiles.forEach((outputFile) => {
    debug(`[listing] Completing listing items ${outputFile.input}`);
    // Does this output file contain a listing?
    if (
      outputFile.format.metadata[kListing] &&
      isHtmlOutput(outputFile.format.pandoc, true)
    ) {
      // Read the listing page
      let fileContents = Deno.readTextFileSync(outputFile.file);

      const listings = Array.isArray(outputFile.format.metadata[kListing])
        ? outputFile.format.metadata[kListing]
        : [outputFile.format.metadata[kListing]];

      listings.forEach((listing) => {
        if (typeof listing === "object") {
          debug(`[listing] Processing listing`);
          const listingMetadata = listing as Metadata;
          // See if there is a default image
          const listingDefaultImage = listingMetadata !== undefined &&
              listingMetadata[kImagePlaceholder] !== undefined
            ? listingMetadata[kImagePlaceholder] as string
            : undefined;

          // Use a regex to identify any placeholders
          const regex = descriptionPlaceholderRegex;
          regex.lastIndex = 0;
          let match = regex.exec(fileContents);
          while (match) {
            debug(`[listing] Processing description match`);
            // For each placeholder, get its target href, then read the contents of that
            // file and inject the contents.
            const maxDescLength = parseInt(match[1]);
            const relativePath = match[2];
            const absolutePath = join(projectOutputDir(context), relativePath);
            const placeholder = descriptionPlaceholder(
              relativePath,
              maxDescLength,
            );
            if (existsSync(absolutePath)) {
              // Truncate the description if need be
              const options = maxDescLength > 0
                ? { "max-length": maxDescLength }
                : {};
              const contents = contentReader(absolutePath, options);

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

          // Use a regex to find image placeholders
          // Placeholders are there to permit images to be appear in the
          // rendered content (e.g. plots from computations) and for those
          // to be used. If an image can't be found this way, a placeholder
          // div will be returned instead.
          const imgRegex = imagePlaceholderRegex;
          imgRegex.lastIndex = 0;
          let imgMatch = imgRegex.exec(fileContents);
          while (imgMatch) {
            debug(`[listing] Processing image match`);
            const progressive = imgMatch[1] === "true";
            const imgHeight = imgMatch[2];
            const docRelativePath = imgMatch[3];
            const docAbsPath = join(projectOutputDir(context), docRelativePath);
            const imgPlaceholder = imagePlaceholder(
              docRelativePath,
              progressive,
              imgHeight,
            );
            debug(`[listing] ${docAbsPath}`);
            debug(`[listing] ${imgPlaceholder}`);

            if (existsSync(docAbsPath)) {
              debug(`[listing] exists: ${docAbsPath}`);
              const contents = contentReader(docAbsPath, {
                remove: { links: true },
              });

              if (contents.previewImage) {
                debug(`[listing] previewImage: ${docAbsPath}`);
                const resolveUrl = (path: string) => {
                  if (isHttpUrl(path)) {
                    return path;
                  } else {
                    const imgAbsPath = isAbsolute(path)
                      ? path
                      : join(dirname(docAbsPath), path);
                    const imgRelPath = relative(
                      dirname(outputFile.file),
                      imgAbsPath,
                    );
                    return imgRelPath;
                  }
                };

                const imgHtml = imageSrc(
                  {
                    ...contents.previewImage,
                    src: resolveUrl(contents.previewImage.src),
                  },
                  progressive,
                  imgHeight,
                );

                debug(`[listing] replacing: ${docAbsPath}`);
                fileContents = fileContents.replace(
                  imgPlaceholder,
                  imgHtml,
                );
              } else if (listingDefaultImage) {
                debug(`[listing] using default image: ${docAbsPath}`);
                const imagePreview: PreviewImage = {
                  src: listingDefaultImage,
                };
                fileContents = fileContents.replace(
                  imgPlaceholder,
                  imageSrc(imagePreview, progressive, imgHeight),
                );
              } else {
                debug(`[listing] using empty div: ${docAbsPath}`);
                fileContents = fileContents.replace(
                  imgPlaceholder,
                  emptyDiv(imgHeight),
                );
              }
            } else {
              debug(`[listing] does not exist: ${docAbsPath}`);
              fileContents = fileContents.replace(
                imgPlaceholder,
                emptyDiv(imgHeight),
              );
              warning(
                `Unable to read listing preview image from ${docRelativePath}`,
              );
            }

            imgMatch = imgRegex.exec(fileContents);
          }
          imgRegex.lastIndex = 0;
        }
      });

      Deno.writeTextFileSync(
        outputFile.file,
        fileContents,
      );
    }
  });
}

function emptyDiv(height?: string) {
  return `<div class="listing-item-img-placeholder card-img-top" ${
    height ? `style="height: ${height};"` : ""
  }>&nbsp;</div>`;
}

function descriptionPlaceholder(file?: string, maxLength?: number): string {
  return file ? `<!-- desc(5A0113B34292)[max=${maxLength}]:${file} -->` : "";
}

export function imagePlaceholder(
  file: string,
  progressive: boolean,
  height?: string,
): string {
  return file
    ? `<!-- img(9CEB782EFEE6)[progressive=${
      progressive ? "true" : "false"
    }, height=${height ? height : ""}]:${file} -->`
    : "";
}

export function isPlaceHolder(text: string) {
  return text.match(descriptionPlaceholderRegex);
}

const descriptionPlaceholderRegex =
  /<!-- desc\(5A0113B34292\)\[max\=(.*)\]:(.*) -->/;

const imagePlaceholderRegex =
  /<!-- img\(9CEB782EFEE6\)\[progressive\=(.*), height\=(.*)\]:(.*) -->/;

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
    } else if (
      !sources.has(ListingItemSource.document) &&
      !sources.has(ListingItemSource.metadataDocument)
    ) {
      // If the items have come from metadata, we should just show
      // all the columns in the table. Otherwise, we should use the
      // document default columns
      const undisplayable = ["path"];
      return itemFields.filter((field) => {
        return !undisplayable.includes(field);
      });
    } else {
      return defaultFields(type, itemFields);
    }
  };

  const suggestedFields = suggestFields(listing.type, itemFields);

  // Don't include fields that the items don't have
  const fields = suggestedFields.filter((field) => {
    // Always include image if suggeted
    if (field === kFieldImage) {
      return true;
    }
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
    [kFieldDisplayNames]: {}, // default values are merged later
    [kFieldTypes]: {}, // default values are merged later
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
    ? [
      { field: kFieldOrder, direction: "asc" },
      { field: kFieldTitle, direction: "asc" },
    ]
    : undefined;
  if (
    sort && !listingHydrated.sort &&
    (sources.has(ListingItemSource.document) ||
      sources.has(ListingItemSource.metadataDocument))
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
    listingHydrated[kMaxDescLength] = listingHydrated[kMaxDescLength] ||
      kDefaultMaxDescLength;
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
    ...kDefaultFieldTypes,
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
  debug(`[listing] Reading listing '${listing.id}' from ${source}`);
  debug(`[listing] Contents: ${
    listing.contents.map((lst) => {
      return typeof lst === "string" ? lst : "<yaml>";
    }).join(",")
  }`);

  const listingItems: ListingItem[] = [];
  const listingItemSources = new Set<ListingItemSource>();

  // Accumulate the files that would be allowed to be included
  // This will include:
  //   - project input files
  const inputsWithoutSource = project.files.input.filter((file) =>
    file !== source
  );

  const filterListingFiles = (globOrPaths: string[]) => {
    const hasDefaultGlob = globOrPaths.some((glob) => {
      return glob === kDefaultContentsGlobToken;
    });

    const resolvedGlobs = globOrPaths.map((glob) => {
      if (glob === kDefaultContentsGlobToken) {
        return "*";
      } else {
        return glob;
      }
    });

    const expandedGlobs = resolvedGlobs.map((resolved) => {
      return expandGlob(source, project, resolved);
    });

    const hasInputs = expandedGlobs.some((expanded) => {
      return !!expanded.inputs;
    });

    const finalGlobs = expandedGlobs.map((expanded) => {
      return expanded.glob;
    });

    // push a glob excluding the project output directory
    const outDir = project.config?.project["output-dir"];
    if (outDir) {
      finalGlobs.push(`!/${outDir}/**`);
    }

    // Convert a bare directory path into a consumer
    // of everything in the directory
    if (hasInputs || hasDefaultGlob) {
      // If this is a glob, expand it
      const filtered = filterPaths(
        dirname(source),
        inputsWithoutSource,
        finalGlobs,
      );

      // If a glob points to a file that exists, go ahead and just include
      // that, even if it isn't a project input
      for (const glob of finalGlobs) {
        if (safeExistsSync(glob) && Deno.statSync(glob).isFile) {
          filtered.include.push(
            isAbsolute(glob) ? glob : join(Deno.cwd(), glob),
          );
        }
      }

      return filtered;
    } else {
      return resolvePathGlobs(
        dirname(source),
        finalGlobs,
        ["_*", ".*", "**/_*", "**/.*", source],
      );
    }
  };

  const contentGlobs = listing.contents.filter((content) => {
    return typeof content === "string";
  }) as string[];

  const contentMetadatas = listing.contents.filter((content) => {
    return typeof content !== "string";
  }) as Metadata[];

  if (contentGlobs.length > 0) {
    const files = filterListingFiles(contentGlobs);
    debug(`[listing] matches ${files.include.length} files:`);

    const readFiles = files.include.filter((file) => {
      return !files.exclude.includes(file);
    });
    if (readFiles.length === 0) {
      const projRelativePath = relative(project.dir, source);
      throw new Error(
        `The listing in '${projRelativePath}' using the following contents:\n- ${
          contentGlobs.join("\n- ")
        }\ndoesn't match any files or folders.`,
      );
    }

    for (const file of readFiles) {
      if (isYamlPath(file)) {
        debug(`[listing] Reading YAML file ${file}`);
        const yaml = readYaml(file);
        if (Array.isArray(yaml)) {
          const items = yaml as Array<unknown>;
          for (const yamlItem of items) {
            if (typeof yamlItem === "object") {
              const { item, source } = await listItemFromMeta(
                yamlItem as Metadata,
                project,
                listing,
                dirname(file),
              );
              validateItem(listing, item, (field: string) => {
                return `An item from the file '${file}' is missing the required field '${field}'.`;
              });
              listingItemSources.add(source);
              listingItems.push(item);
            } else {
              throw new Error(
                `Unexpected listing contents in file ${file}. The array may only contain listing items, not paths or other types of data.`,
              );
            }
          }
        } else if (typeof yaml === "object") {
          const { item, source } = await listItemFromMeta(
            yaml as Metadata,
            project,
            listing,
            dirname(file),
          );
          validateItem(listing, item, (field: string) => {
            return `The item defined in file '${file}' is missing the required field '${field}'.`;
          });
          listingItemSources.add(source);
          listingItems.push(item);
        } else {
          throw new Error(
            `Unexpected listing contents in file ${file}. The file should contain only one more listing items.`,
          );
        }
      } else {
        const isFile = Deno.statSync(file).isFile;
        if (isFile) {
          debug(`[listing] Reading file ${file}`);
          const item = await listItemFromFile(file, project, listing);
          if (item) {
            validateItem(listing, item, (field: string) => {
              return `The file ${file} is missing the required field '${field}'.`;
            });

            if (item.item.title === undefined) {
              debug(`[listing] Missing Title in File ${file}`);
            }

            listingItemSources.add(item.source);
            listingItems.push(item.item);
          }
        }
      }
    }
  }

  // Process any metadata that appears in contents
  if (contentMetadatas.length > 0) {
    for (const content of contentMetadatas) {
      const { item, source: itemSource } = await listItemFromMeta(
        content,
        project,
        listing,
        dirname(source),
      );
      validateItem(listing, item, (field: string) => {
        return `An item in the listing '${listing.id}' is missing the required field '${field}'.`;
      });
      listingItemSources.add(itemSource);
      listingItems.push(item);
    }
  }

  const matchesField = (item: ListingItem, field: string, value: unknown) => {
    const simpleValueMatches = (
      itemValue: unknown,
      listingValue: unknown,
    ) => {
      if (
        typeof itemValue === "string" && typeof listingValue === "string"
      ) {
        const regex = globToRegExp(listingValue);
        return itemValue.match(regex);
      } else {
        return itemValue === listingValue;
      }
    };

    const valueMatches = (
      item: ListingItem,
      field: string,
      value: unknown,
    ) => {
      if (Array.isArray(item[field])) {
        const fieldValues = item[field] as Array<unknown>;
        return fieldValues.some((fieldVal) => {
          return simpleValueMatches(fieldVal, value);
        });
      } else {
        return simpleValueMatches(item[field], value);
      }
    };

    if (Array.isArray(value)) {
      return value.some((val) => {
        return valueMatches(item, field, val);
      });
    } else {
      return valueMatches(item, field, value);
    }
  };

  // Apply any listing filters
  let filtered = listingItems;
  const includes = listing[kInclude] as Record<string, unknown>;
  if (includes) {
    debug(
      `[listing] applying filter to include only items matching ${includes}`,
    );

    const fields = Object.keys(includes);
    filtered = filtered.filter((item) => {
      return fields.every((field) => {
        return matchesField(item, field, includes[field]);
      });
    });

    debug(`[listing] afer including, ${filtered.length} item match listing`);
  }

  const excludes = listing[kExclude] as Record<string, unknown>;
  if (excludes) {
    debug(`[listing] applying filter to exclude items matching ${includes}`);
    const fields = Object.keys(excludes);
    filtered = filtered.filter((item) => {
      return !fields.some((field) => {
        return matchesField(item, field, excludes[field]);
      });
    });
    debug(`[listing] afer excluding, ${filtered.length} item match listing`);
  }

  return {
    items: filtered,
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

async function listItemFromMeta(
  meta: Metadata,
  project: ProjectContext,
  listing: ListingDehydrated,
  baseDir: string,
): Promise<{ item: ListingItem; source: ListingItemSource }> {
  let listingItem: ListingItem = cloneDeep(meta);
  let source = ListingItemSource.metadata;

  // If there is a path, try to complete the filename and
  // modified values
  if (typeof meta.path === "string") {
    const base = basename(meta.path);
    const extension = extname(base).toLocaleLowerCase();
    meta[kFieldFileName] = base;
    meta[kFieldFileModified] = fileModifiedDate(meta.path);

    const markdownExtensions = [".qmd", ".md", ".rmd"];
    if (markdownExtensions.indexOf(extension) !== -1) {
      const inputPath = isAbsolute(meta.path)
        ? meta.path
        : join(baseDir, meta.path);

      const fileListing = await listItemFromFile(inputPath, project, listing);
      if (fileListing === undefined) {
        warning(
          `Draft document ${meta.path} found in a custom listing: item will not have computed metadata.`,
        );
      } else {
        listingItem = {
          ...(fileListing.item || {}),
          ...listingItem,
        };
        source = ListingItemSource.metadataDocument;
      }
    }
  }

  if (meta.author) {
    if (!Array.isArray(meta.author)) {
      meta.author = [meta.author];
    }
  }

  if (meta.date) {
    if (meta.path !== undefined) {
      listingItem.date = parsePandocDate(
        resolveDate(meta.path as string, meta.date) as string,
      );
    } else {
      listingItem.date = parsePandocDate(meta.date as string);
    }
  }

  return {
    item: listingItem,
    source,
  };
}

async function listItemFromFile(
  input: string,
  project: ProjectContext,
  listing: ListingDehydrated,
) {
  if (!isAbsolute(input)) {
    throw new InternalError(`input path ${input} must be absolute.`);
  }
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
  const directoryMetadata = await directoryMetadataForInputFile(
    project,
    dirname(input),
  );
  const documentMeta = mergeConfigs(
    project.config,
    directoryMetadata,
    docRawMetadata,
  ) as Metadata;

  if (documentMeta?.draft) {
    // This is a draft, don't include it in the listing
    return undefined;
  } else {
    if (
      !docRawMetadata && (extname(input) === ".qmd" ||
        extname(input) === ".ipynb")
    ) {
      warning(
        `File ${input} in the listing '${listing.id}' contains no metadata.`,
      );
    }

    // See if we have a max desc length
    const maxDescLength = listing[kMaxDescLength] as number ||
      kDefaultMaxDescLength;

    // Create the item
    const filename = basename(projectRelativePath);
    const filemodified = fileModifiedDate(input);

    const description = documentMeta?.description as string ||
      documentMeta?.abstract as string ||
      descriptionPlaceholder(inputTarget?.outputHref, maxDescLength);

    const imageRaw = documentMeta?.image as string;
    const image = imageRaw !== undefined
      ? pathWithForwardSlashes(
        listingItemHref(imageRaw, dirname(projectRelativePath)),
      )
      : undefined;

    const imageAlt = documentMeta?.[kImageAlt] as string | undefined;

    const date = documentMeta?.date
      ? parsePandocDate(resolveDate(input, documentMeta?.date) as string)
      : undefined;

    const datemodified = documentMeta?.date
      ? parsePandocDate(
        resolveDate(input, documentMeta?.[kDateModified]) as string,
      )
      : undefined;

    const authors = parseAuthor(documentMeta?.author);
    let structuredAuthors;
    if (authors) {
      structuredAuthors = cslNames(
        authors?.filter((auth) => auth !== undefined).map((auth) => auth?.name),
      );
    }
    const author = structuredAuthors
      ? structuredAuthors.map((auth) =>
        auth.literal || `${auth.given} ${auth.family}`
      )
      : [];

    const readingContext = target?.markdown
      ? estimateReadingTimeMinutes(target.markdown.markdown)
      : undefined;
    let readingtime = undefined;
    let wordcount = undefined;
    if (readingContext) {
      readingtime = readingContext.readingTime;
      wordcount = readingContext.wordCount;
    }

    const categories = documentMeta?.categories
      ? Array.isArray(documentMeta?.categories)
        ? documentMeta?.categories
        : [documentMeta?.categories]
      : undefined;

    const item: ListingItem = {
      ...documentMeta,
      path: `/${projectRelativePath}`,
      outputHref: inputTarget?.outputHref,
      [kFieldTitle]: target?.title,
      [kFieldDate]: date,
      [kFieldDateModified]: datemodified,
      [kFieldAuthor]: author,
      [kFieldCategories]: categories,
      [kFieldImage]: image,
      [kFieldImageAlt]: imageAlt,
      [kFieldDescription]: description,
      [kFieldFileName]: filename,
      [kFieldFileModified]: filemodified,
      [kFieldReadingTime]: readingtime,
      [kFieldWordCount]: wordcount,
    };
    return {
      item,
      source: target !== undefined
        ? ListingItemSource.document
        : ListingItemSource.rawfile,
    };
  }
}

function imageSrc(image: PreviewImage, progressive: boolean, height?: string) {
  return `<p class="card-img-top"><img ${
    progressive ? "data-src" : "src"
  }="${image.src}" ${image.alt ? `alt="${image.alt}" ` : ""}${
    height ? `style="height: ${height};" ` : ""
  }${
    image.title ? `title="${image.title}"` : ""
  } class="thumbnail-image card-img"/></p>`;
}

// Processes the 'listing' metadata into an
// array of Listings to be processed
function readDehydratedListings(
  source: string,
  format: Format,
): ListingDehydrated[] {
  const listingConfig = format.metadata[kListing];
  const listings: ListingDehydrated[] = [];
  if (typeof listingConfig == "string") {
    // Resolve this string
    const listing = listingForType(listingType(listingConfig));
    if (listing) {
      listings.push(listing);
    }
  } else if (Array.isArray(listingConfig)) {
    // Process an array of listings
    const listingConfigs = listingConfig.filter((listing) =>
      typeof listing === "object"
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
  } else if (listingConfig && typeof listingConfig === "object") {
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

    if (typeof sortValue === "string") {
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

  if (typeof rawValue === "boolean") {
    if (rawValue) {
      // Apply default sorting behavior
      return undefined;
    } else {
      // Don't apply sorting
      return [];
    }
  } else {
    // Apply sorting
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
  }
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
  if (safeExistsSync(input)) {
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
