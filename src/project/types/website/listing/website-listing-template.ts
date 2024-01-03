/*
* website-listing-template
.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { cloneDeep, escape } from "../../../../core/lodash.ts";
import {
  kListingPageMinutesCompact,
  kListingPageOrderByDateAsc,
  kListingPageOrderByDateDesc,
  kListingPageOrderByNumberAsc,
  kListingPageOrderByNumberDesc,
  kListingPageWords,
} from "../../../../config/constants.ts";
import { Format } from "../../../../config/types.ts";

import { renderEjs } from "../../../../core/ejs.ts";
import {
  kFieldDate,
  kFieldDisplayNames,
  kFieldFileModified,
  kFieldFilter,
  kFieldLinks,
  kFields,
  kFieldSort,
  kFieldTypes,
  kImageHeight,
  kMaxDescLength,
  kMaxItems,
  kPageSize,
  kSortAsc,
  kSortDesc,
  Listing,
  ListingItem,
  ListingSort,
  ListingType,
} from "./website-listing-shared.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { localizedString } from "../../../../config/localization.ts";
import { formatDate, parsePandocDate } from "../../../../core/date.ts";
import { truncateText } from "../../../../core/text.ts";
import { encodeAttributeValue } from "../../../../core/html.ts";
import { imagePlaceholder, isPlaceHolder } from "./website-listing-read.ts";

export const kDateFormat = "date-format";

export const kQuartoListingClass = "quarto-listing";

// Create a markdown handler for the markdown pipeline
// This will render an EJS template into markdown
// (providing options and items to the template)
// make that markdown available to the pipeline,
// then insert the rendered HTML into the document
export function templateMarkdownHandler(
  template: string,
  listing: Listing,
  items: ListingItem[],
  format: Format,
  cache: boolean,
  attributes?: Record<string, string>,
) {
  // Process the items into simple key value pairs, applying
  // any formatting
  const reshapedItems: Record<string, unknown | undefined>[] = items.map(
    (item) => {
      resolveItemForTemplate(item, listing);

      const record: Record<string, unknown | undefined> = { ...item };

      if (item.author) {
        if (Array.isArray(item.author)) {
          record.author = item.author.join(", ");
        } else {
          record.author = item.author;
        }
      }

      // Format date values
      // Read date formatting from an option, if present
      const dateFormat = listing[kDateFormat] as string ||
        format.metadata[kDateFormat] as string;

      const fieldLabelLangKeys: Record<string, string> = {
        "word-count": kListingPageWords,
      };

      const fieldTypes = listing[kFieldTypes];
      for (const field of Object.keys(fieldTypes)) {
        if (fieldTypes[field] === kFieldDate) {
          const dateRaw = item[field];
          if (dateRaw) {
            // For file modified specifically, include the time portion
            const includeTime = field === kFieldFileModified;

            const date = typeof dateRaw === "string"
              ? parsePandocDate(dateRaw as string)
              : dateRaw as Date;
            if (date) {
              record[field] = dateFormat
                ? formatDate(date, dateFormat)
                : includeTime
                ? formatDate(
                  date,
                  "short",
                  "medium",
                )
                : formatDate(date, "medium");
            }
          }
        } else if (fieldTypes[field] === "minutes" && item[field]) {
          const val = item[field] as number;
          record[field] = localizedString(format, kListingPageMinutesCompact, [
            Math.floor(val).toString(),
          ]);
        } else if (
          fieldTypes[field] === "number" && item[field] !== undefined &&
          fieldLabelLangKeys[field] !== undefined
        ) {
          const val = item[field] as number;
          record[field] = localizedString(format, fieldLabelLangKeys[field], [
            Math.floor(val).toLocaleString(),
          ]);
        }
      }

      if (item.description !== undefined && !isPlaceHolder(item.description)) {
        const maxDescLength = listing[kMaxDescLength] as number ||
          -1;
        if (maxDescLength > 0) {
          record.description = truncateText(
            item.description,
            maxDescLength,
            "space",
          );
        }
      }
      return record;
    },
  );

  const reshapedListing = reshapeListing(listing, format);
  const tempateItems = listing[kMaxItems]
    ? reshapedItems.slice(0, listing[kMaxItems])
    : reshapedItems;

  const paramsForType = (type: ListingType) => {
    // For built in templates, provide the listing and items
    // For custom templates, provide only the list of items
    const ejsParams: Record<string, unknown> = {
      items: tempateItems,
    };
    ``;

    if (type !== ListingType.Custom) {
      ejsParams.listing = reshapedListing;
    } else {
      ejsParams["metadataAttrs"] = reshapedListing.utilities.metadataAttrs;
      ejsParams["templateParams"] = reshapedListing["template-params"];
    }
    return ejsParams;
  };

  // Render the filter
  const filterRendered = renderEjs(
    resourcePath("projects/website/listing/_filter.ejs.md"),
    {
      items: tempateItems,
      listing: reshapedListing,
    },
  );

  // Render the template
  let templateRendered = renderEjs(
    template,
    paramsForType(listing.type),
    false,
    cache,
  );

  // Collapses repeated whitespace
  // this allows whitespace to appear, but prevents a huge amount of whitepsace from making
  // super cluttered HTML
  // whitespace is imporant since this prevents Pandoc from interpretting run-on HTML
  // as potentially containing inlines, for example
  // https://github.com/quarto-dev/quarto-cli/issues/6745
  templateRendered = templateRendered.replace(/(\r\n|\r|\n){2,}/g, "$1$1");

  // Render the pagination
  const paginationRendered = renderEjs(
    resourcePath("projects/website/listing/_pagination.ejs.md"),
    {
      items: tempateItems,
      listing: reshapedListing,
    },
  );

  // Render the template into markdown
  const markdown = [filterRendered, templateRendered, paginationRendered].join(
    "\n",
  );

  const pipelineId = (id: string) => {
    return `pipeline-listing-${id}`;
  };

  // Return the handler
  return {
    getUnrendered() {
      return {
        blocks: {
          [pipelineId(listing.id)]: markdown,
        },
      };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      // See if there is a target div already in the page
      // This will match our default page layout
      let listingEl = doc.querySelector(`div[id='${listing.id}']`);
      if (listingEl === null && listing.autoId) {
        // This was an automatically provisioned id, just insert this item
        // No target div, cook one up
        const content = doc.querySelector("#quarto-content main.content");
        listingEl = doc.createElement("div");
        if (content) {
          content.appendChild(listingEl);
        } else {
          // Custom page layout doesn't have a main.content, so
          // just use the quarto-content div directly
          const customContent = doc.querySelector("#quarto-content");
          if (customContent) {
            customContent.appendChild(listingEl);
          } else {
            // Couldn't find anywhere to put the listing el, just
            // stick at the bottom of the body
            doc.body.appendChild(listingEl);
          }
        }
      }

      // Append any requested classes
      if (!listingEl?.classList.contains(kQuartoListingClass)) {
        listingEl?.classList.add(kQuartoListingClass);
      }
      listingEl?.classList.add(`quarto-listing-container-${listing.type}`);

      // Add attributes
      const outListingId = `listing-${listing.id}`;
      listingEl?.setAttribute("id", outListingId);
      if (attributes) {
        Object.keys(attributes).forEach((attrName) => {
          listingEl?.setAttribute(attrName, attributes[attrName]);
        });
      }

      const renderedEl = rendered[pipelineId(listing.id)];
      if (renderedEl && listingEl) {
        listingEl.innerHTML = renderedEl.innerHTML;
      }
    },
  };
}

// Items in templates need to carry additional information to assist
// rendering. For example, item fields that are non string types
// need to carry a sortable version of their value (e.g. a date needs
// a sortable version of the date)- this function will resolve item
// data into template ready versions of the item
export function resolveItemForTemplate(
  item: ListingItem,
  listing: Listing,
) {
  // add sort key if needed
  const addSortable = (item: ListingItem, field: string, value: string) => {
    item.sortableValues = item.sortableValues || {};
    item.sortableValues[field] = value;
  };

  // Add sortable values for fields of variant types
  for (const field of Object.keys(listing[kFieldTypes])) {
    const type = listing[kFieldTypes][field];
    if (item[field] !== undefined) {
      if (type === "date") {
        addSortable(item, field, (item[field] as Date).valueOf().toString());
      } else if (type === "number") {
        addSortable(item, field, (item[field] as number).toString());
      } else if (type === "minutes") {
        addSortable(item, field, (item[field] as number).toString());
      }
    }
  }

  // Add sortable values for fields that will be linked
  for (const field of listing[kFieldLinks]) {
    const val = item[field];
    if (val !== undefined) {
      addSortable(item, field, val as string);
    }
  }
}

export interface ReshapedListing extends Listing {
  utilities: Record<string, unknown>;
}

// Options may also need computation / resolution before being handed
// off to the template. This function will do any computation on the options
// so they're ready for the template
export function reshapeListing(
  listing: Listing,
  format: Format,
): ReshapedListing {
  const reshaped = cloneDeep(listing) as Listing;

  // Add template utilities
  const utilities = {} as Record<string, unknown>;
  utilities.sortableFieldData = () => {
    const fieldSortData: Array<{
      listingSort: ListingSort;
      description: string;
    }> = [];

    reshaped[kFieldSort].filter((field) => {
      return reshaped.fields.includes(field);
    }).forEach((field) => {
      if (reshaped[kFieldTypes][field] === "date") {
        fieldSortData.push({
          listingSort: {
            field: sortAttrValue(field),
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldDisplayNames][field] || field} - ${
            format.language[kListingPageOrderByDateAsc]
          }`,
        });

        fieldSortData.push({
          listingSort: {
            field: sortAttrValue(field),
            direction: kSortDesc,
          },
          description: `${reshaped[kFieldDisplayNames][field] || field} - ${
            format.language[kListingPageOrderByDateDesc]
          }`,
        });
      } else if (
        reshaped[kFieldTypes][field] === "number" ||
        reshaped[kFieldTypes][field] === "minutes"
      ) {
        fieldSortData.push({
          listingSort: {
            field: sortAttrValue(field),
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldDisplayNames][field] || field} (${
            format.language[kListingPageOrderByNumberAsc]
          })`,
        });
        fieldSortData.push({
          listingSort: {
            field: sortAttrValue(field),
            direction: kSortDesc,
          },
          description: `${reshaped[kFieldDisplayNames][field] || field} (${
            format.language[kListingPageOrderByNumberDesc]
          })`,
        });
      } else {
        const sortField = useSortTarget(listing, field)
          ? sortAttrValue(field)
          : `listing-${field}`;
        fieldSortData.push({
          listingSort: {
            field: sortField,
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldDisplayNames][field] || field}`,
        });
      }
    });

    return fieldSortData;
  };
  utilities.fieldName = (field: string) => {
    return reshaped[kFieldDisplayNames][field] || field;
  };
  utilities.outputLink = (
    item: ListingItem,
    field: string,
    val?: string,
    clz?: string,
  ) => {
    const fieldLinks = reshaped[kFieldLinks];
    const value = val || item[field] || "&nbsp;";
    const path = item.path;
    if (path && value !== undefined && fieldLinks.includes(field)) {
      return `<a href="${path}" class="${field}${
        clz ? ` ${clz}` : ""
      }">${value}</a>`;
    } else {
      if (clz) {
        return `<span class="${clz}">${value}</span>`;
      } else {
        return value;
      }
    }
  };
  utilities.sortTarget = (field: string) => {
    if (useSortTarget(listing, field)) {
      return sortAttrValue(field);
    } else {
      return `listing-${field}`;
    }
  };
  let itemNumber = 0;
  utilities.itemNumber = () => {
    return ++itemNumber;
  };
  utilities.img = (
    itemNumber: number,
    src: string,
    classes: string,
    alt?: string,
  ) => {
    const pageSize = listing[kPageSize];
    const classAttr = classes ? `class="${classes}"` : "";
    const styleAttr = listing[kImageHeight]
      ? `style="height: ${listing[kImageHeight]};"`
      : "";
    const altAttr = alt ? `alt="${encodeAttributeValue(alt)}"` : "";
    const srcAttr = itemNumber > pageSize ? "data-src" : "src";

    return `<img ${srcAttr}="${src}" ${classAttr} ${styleAttr} ${altAttr}>`;
  };
  utilities.imgPlaceholder = (
    itemNumber: number,
    itemPath: string,
  ) => {
    const pageSize = listing[kPageSize];
    return imagePlaceholder(
      itemPath,
      itemNumber > pageSize,
      listing[kImageHeight] as string,
    );
  };

  let index = 0;
  utilities.metadataAttrs = (item: ListingItem) => {
    const attr: Record<string, string> = {};

    attr["index"] = (index++).toString();
    if (item.categories) {
      attr["categories"] = (item.categories as string[]).join(",");
    }

    // Add magic attributes for the sortable values
    item.sortableValues = item.sortableValues || {};
    for (const field of Object.keys(item.sortableValues)) {
      if (useSortTarget(listing, field)) {
        attr[sortAttrValue(field)] = escape(
          item.sortableValues[field],
        );
      }
    }

    const attrs = Object.keys(attr).map((key) => {
      const value = attr[key];
      return `data-${key}='${value}'`;
    });
    return attrs.join(" ");
  };
  utilities.localizedString = (str: string) => {
    const localizedStrings = format.language as Record<string, string>;
    return localizedStrings[str];
  };
  reshaped.utilities = utilities;
  return reshaped as ReshapedListing;
}

function sortAttrValue(field: string) {
  return `listing-${field}-sort`;
}

const useSortTarget = (listing: Listing, field: string) => {
  // Use data field for values that will be wrapped in links
  const links = listing[kFieldLinks];
  if (links.includes(field)) {
    return true;
  }

  // Use data field for date and numbers
  const type = listing[kFieldTypes][field];
  if (type === "date" || type === "number" || type === "minutes") {
    return true;
  } else if (listing[kFieldLinks].includes(field)) {
    return true;
  }

  return false;
};

// Generates the script tag for this listing / template
// This binds list.js to the listing, enabling
// sorting, pagings, filtering, etc...
export function templateJsScript(
  id: string,
  listing: Listing,
  itemCount: number,
) {
  const pageSize = listing[kPageSize] as number || 50;

  // If columns are present, factor that in
  const columns = listing[kFields] as string[] || [];

  const pageOptions = itemCount > pageSize
    ? `${pageSize ? `page: ${pageSize}` : ""},
    pagination: { item: "<li class='page-item'><a class='page page-link' href='#'></a></li>" },`
    : "";

  const filterOptions = `searchColumns: [${
    listing[kFieldFilter].map((field) => {
      return `"listing-${field}"`;
    }).join(",")
  }],`;

  const resolvedColumns = columns.map((field) => {
    return `'listing-${field}'`;
  });
  resolvedColumns.push(
    `{ data: ['index'] }`,
    `{ data: ['categories'] }`,
  );
  for (const field of listing[kFieldSort]) {
    if (useSortTarget(listing, field)) {
      resolvedColumns.push(`{ data: ['${sortAttrValue(field)}'] }`);
    }
  }

  const rowJs = `[${resolvedColumns.join(",")}]`;

  const jsScript = `
  window.document.addEventListener("DOMContentLoaded", function (_event) {
    const listingTargetEl = window.document.querySelector('#listing-${id} .list');
    if (!listingTargetEl) {
      // No listing discovered, do not attach.
      return; 
    }

    const options = {
      valueNames: ${rowJs},
      ${pageOptions}
      ${filterOptions}
    };

    window['quarto-listings'] = window['quarto-listings'] || {};
    window['quarto-listings']['listing-${id}'] = new List('listing-${id}', options);

    if (window['quarto-listing-loaded']) {
      window['quarto-listing-loaded']();
    }
  });

  window.addEventListener('hashchange',() => {
    if (window['quarto-listing-loaded']) {
      window['quarto-listing-loaded']();
    }
  })
  `;
  return jsScript;
}
