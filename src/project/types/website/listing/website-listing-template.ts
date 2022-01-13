/*
* website-listing-template
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { format as formatDate } from "datetime/mod.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { cloneDeep, escape } from "../../../../core/lodash.ts";
import {
  kListingPageOrderByDateAsc,
  kListingPageOrderByDateDesc,
  kListingPageOrderByNumberAsc,
  kListingPageOrderByNumberDesc,
  kListingPageOrderByStringAsc,
} from "../../../../config/constants.ts";
import { Format } from "../../../../config/types.ts";

import { renderEjs } from "../../../../core/ejs.ts";
import {
  kColumnCount,
  kFieldLinks,
  kFieldNames,
  kFields,
  kFieldSort,
  kFieldSortTargets,
  kFieldTypes,
  kRowCount,
  Listing,
  ListingItem,
  ListingSort,
  ListingType,
} from "./website-listing-shared.ts";
import {
  kFieldDate,
  kFieldFileModified,
  kSortAsc,
  kSortDesc,
} from "./website-listing-read.ts";

export const kDateFormat = "date-format";
export const kMaxDescLength = "max-description-length";

export const kCardColumnSpan = "card-column-span";

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
  attributes?: Record<string, string>,
) {
  // Process the items into simple key value pairs, applying
  // any formatting
  const reshapedItems: Record<string, unknown | undefined>[] = items.map(
    (item) => {
      resolveItemForTemplate(item, listing);

      const record: Record<string, unknown | undefined> = { ...item };

      if (item.author) {
        record.author = item.author.join(", ");
      }

      // Format date values
      // Read date formatting from an option, if present
      const dateFormat = listing[kDateFormat] as string;

      const fieldTypes = listing[kFieldTypes];
      for (const field of Object.keys(fieldTypes)) {
        if (fieldTypes[field] === kFieldDate) {
          const dateRaw = item[field];
          if (dateRaw) {
            // For file modified specifically, include the time portion
            const includeTime = field === kFieldFileModified;

            const date = typeof (dateRaw) === "string"
              ? new Date(dateRaw as string)
              : dateRaw as Date;
            record[field] = dateFormat
              ? formatDate(date, dateFormat)
              : includeTime
              ? date.toLocaleString()
              : date.toLocaleDateString();
          }
        }
      }

      if (item.description !== undefined) {
        const maxDescLength = listing[kMaxDescLength] as number ||
          -1;
        if (maxDescLength > 0) {
          record.description = truncateText(item.description, maxDescLength);
        }
      }

      return record;
    },
  );

  // For built in templates, provide the listing and items
  // For custom templates, provide only the list of items
  const ejsParams: Record<string, unknown> = {
    items: reshapedItems,
  };
  if (listing.type !== ListingType.Custom) {
    ejsParams.listing = reshapeListing(listing, format);
  }

  // Render the template into markdown
  const markdown = renderEjs(
    template,
    ejsParams,
    false,
  );

  const pipelineId = (id: string) => {
    return `pipeline-${id}`;
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
      let listingEl = doc.getElementById(listing.id);
      if (listingEl === null) {
        // No target div, cook one up
        const content = doc.querySelector("#quarto-content main.content");
        if (content) {
          listingEl = doc.createElement("div");
          listingEl.setAttribute("id", listing.id);
          content.appendChild(listingEl);
        }
      }

      // Append any requested classes
      if (listing.classes) {
        listing.classes.forEach((clz) => listingEl?.classList.add(clz));
      }

      // Add attributes
      if (attributes) {
        Object.keys(attributes).forEach((attrName) => {
          listingEl?.setAttribute(attrName, attributes[attrName]);
        });
      }

      const renderedEl = rendered[pipelineId(listing.id)];
      listingEl!.innerHTML = renderedEl.innerHTML;
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

// Options may also need computation / resolution before being handed
// off to the template. This function will do any computation on the options
// so they're ready for the template
export function reshapeListing(
  listing: Listing,
  format: Format,
) {
  const reshaped = cloneDeep(listing) as Listing;
  if (reshaped.type === ListingType.Grid) {
    // Compute the bootstrap column span of each card
    reshaped[kCardColumnSpan] = columnSpan(
      reshaped[kColumnCount] as number,
    );
  }
  // Compute the sorting targets for the fields
  reshaped[kFieldSortTargets] = computeSortingTargets(reshaped);

  // Add template utilities
  const utilities = {} as Record<string, unknown>;
  utilities.sortableColumns = () => {
    return reshaped[kFieldSort].filter((col) => {
      return reshaped.fields.includes(col);
    });
  };
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
            field,
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldNames][field] || field} (${
            format.language[kListingPageOrderByDateAsc]
          })`,
        });

        fieldSortData.push({
          listingSort: {
            field,
            direction: kSortDesc,
          },
          description: `${reshaped[kFieldNames][field] || field} (${
            format.language[kListingPageOrderByDateDesc]
          })`,
        });
      } else if (reshaped[kFieldTypes][field] === "number") {
        fieldSortData.push({
          listingSort: {
            field,
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldNames][field] || field} (${
            format.language[kListingPageOrderByNumberAsc]
          })`,
        });
        fieldSortData.push({
          listingSort: {
            field,
            direction: kSortDesc,
          },
          description: `${reshaped[kFieldNames][field] || field} (${
            format.language[kListingPageOrderByNumberDesc]
          })`,
        });
      } else {
        fieldSortData.push({
          listingSort: {
            field,
            direction: kSortAsc,
          },
          description: `${reshaped[kFieldNames][field] || field} (${
            format.language[kListingPageOrderByStringAsc]
          })`,
        });
      }
    });

    return fieldSortData;
  };

  utilities.fieldName = (field: string) => {
    return reshaped[kFieldNames][field] || field;
  };
  utilities.outputLink = (item: ListingItem, field: string, val?: string) => {
    const fieldLinks = reshaped[kFieldLinks];
    const value = val || item[field];
    const path = item.path;
    if (path && value !== undefined && fieldLinks.includes(field)) {
      return `<a href="${path}">${value}</a>`;
    } else {
      return value;
    }
  };
  utilities.sortClass = (field: string) => {
    const colSortTargets = reshaped[kFieldSortTargets];
    if (!colSortTargets || colSortTargets[field] === field) {
      return "";
    } else {
      return ` ${escape(colSortTargets[field])}`;
    }
  };
  utilities.sortTarget = (field: string) => {
    const colSortTargets = reshaped[kFieldSortTargets];
    if (!colSortTargets || colSortTargets[field] === field) {
      return field;
    } else {
      return colSortTargets[field];
    }
  };
  utilities.sortAttr = (item: ListingItem, field: string) => {
    item.sortableValues = item.sortableValues || {};
    const colSortTargets = reshaped[kFieldSortTargets];
    if (!colSortTargets || colSortTargets[field] === field) {
      return "";
    } else {
      return `data-${colSortTargets[field]}="${
        escape(item.sortableValues[field])
      }"`;
    }
  };
  utilities.localizedString = (str: string) => {
    const localizedStrings = (format.language as Record<string, string>);
    return localizedStrings[str];
  };
  reshaped.utilities = utilities;
  return reshaped;
}

// Determine the target value for sorting a field
// Fields need a special sorting target if they are a non-string
// data type (e.g. a number or date), or if they are going to be
// linked (since the 'value' will be surrounded by the href tag, which
// will interfere with sorthing)
function computeSortingTargets(
  listing: Listing,
): Record<string, string> {
  const sortingTargets: Record<string, string> = {};
  const columns = listing[kFields];
  const columnLinks = listing[kFieldLinks];
  const fieldTypes = listing[kFieldTypes];
  columns.forEach((field) => {
    // The data type of this column
    const fieldType = fieldTypes[field];

    // Figure out whether we should use a sort target or not
    const useTarget = columnLinks.includes(field) ||
      fieldType === "date" ||
      fieldType === "number";

    if (useTarget) {
      sortingTargets[field] = `${field}-value`;
    } else {
      sortingTargets[field] = field;
    }
  });
  return sortingTargets;
}

// Generates the script tag for this listing / template
// This binds list.js to the listing, enabling
// sorting, pagings, filtering, etc...
export function templateJsScript(
  id: string,
  listing: Listing,
  itemCount: number,
) {
  const columnCount = listing[kColumnCount] as number || 0;
  const rowCount = listing[kRowCount] as number || 50;

  // If columns are present, factor that in
  const pageCount = columnCount > 0 ? rowCount * columnCount : rowCount;

  const columns = listing[kFields] as string[] || [];

  const pageJs = itemCount > pageCount
    ? `${pageCount ? `page: ${pageCount}` : ""},
    pagination: { item: "<li class='page-item'><a class='page page-link' href='#'></a></li>" }`
    : "";

  const useDataField = (field: string) => {
    const type = listing[kFieldTypes][field];
    if (type === "date" || type === "number") {
      return true;
    } else if (listing[kFieldLinks].includes(field)) {
      return true;
    }
    return false;
  };

  const formatItem = (field: string) => {
    if (useDataField(field)) {
      return [
        `"${field}"`,
        `{ attr: 'data-${field}-value', name: '${field}-value'}`,
      ];
    } else {
      return `"${field}"`;
    }
  };

  const rowJs = `[${
    columns.flatMap((field) => {
      return formatItem(field);
    }).join(",")
  }]`;

  const jsScript = `
  window.document.addEventListener("DOMContentLoaded", function (_event) {
    const options = {
      valueNames: ${rowJs},
      ${pageJs}
    };

    window['quarto-listings'] = window['quarto-listings'] || {};
    window['quarto-listings']['${id}'] = new List('${id}', options);
  });
  `;
  return jsScript;
}

// Forces a user input column value into the appropriate
// grid span bucket
const kGridColSize = 24;
const kGridValidSpans = [2, 3, 4, 6, 8, 12, 24];
function columnSpan(columns: number) {
  const rawValue = kGridColSize / columns;
  for (let i = 0; i < kGridValidSpans.length; i++) {
    const validSpan = kGridValidSpans[i];
    if (rawValue === validSpan) {
      return rawValue;
    } else if (
      i < kGridValidSpans.length && rawValue < kGridValidSpans[i + 1]
    ) {
      return validSpan;
    } else if (i === kGridValidSpans.length - 1) {
      return kGridValidSpans[i];
    }
  }
  return rawValue;
}

function truncateText(text: string, length: number) {
  if (text.length < length) {
    return text;
  } else {
    // Since we'll insert elips, trim an extra space
    const clipLength = length - 1;
    const clipped = text.substring(0, clipLength);
    const lastSpace = clipped.lastIndexOf(" ");
    if (lastSpace > 0) {
      return clipped.substring(0, lastSpace) + "…";
    } else {
      return clipped + "…";
    }
  }
}
