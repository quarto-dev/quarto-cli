/*
* website-listing-template
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { format } from "datetime/mod.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { renderEjs } from "../../../../core/ejs.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { Listing, ListingItem } from "./website-listing-shared.ts";

export const kColumns = "columns";
export const kColumnNames = "column-names";
export const kColumnLinks = "column-links";
export const kColumnTypes = "column-types";
export const kColumnSortTargets = "column-sort-targets";

export const kRowCount = "row-count";
export const kColumnCount = "column-count";

export const kAllowFilter = "allow-filter";
export const kAllowSort = "allow-sort";

export const kDateFormat = "date-format";
export const kImageHeight = "image-height";
export const kImageAlign = "image-align";
export const kMaxDescLength = "max-description-length";

export const kCardColumnSpan = "card-column-span";

export type ColumnType = "date" | "string" | "number";

const kDefaultTableColumns = ["date", "title", "author", "filename"];
const kDefaultGridColumns = [
  "title",
  "subtitle",
  "author",
  "image",
  "description",
];
const kDefaultColumns = [
  "date",
  "title",
  "author",
  "subtitle",
  "image",
  "description",
];

const kDefaultColumnLinks = ["title", "filename"];
// TODO: Localize
const kDefaultColumnNames = {
  "image": " ",
  "date": "Date",
  "title": "Title",
  "description": "Description",
  "author": "Author",
  "filename": "File Name",
  "filemodified": "Modified",
};
const kDefaultColumnTypes: Record<string, ColumnType> = {
  "date": "date",
  "filemodified": "date",
};

export interface TemplateOptions extends Record<string, unknown> {
  [kColumns]: string[];
  [kColumnNames]: Record<string, string>;
  [kColumnTypes]: Record<string, ColumnType>;
  [kColumnLinks]: string[];
  [kColumnSortTargets]: Record<string, string>;
  [kRowCount]: number;
  [kAllowFilter]: boolean;
  [kAllowSort]: boolean;
}

export interface DefaultTemplateOptions extends TemplateOptions {
  [kImageAlign]: "right" | "left";
}

// Create a markdown handler for the markdown pipeline
// This will render an EJS template into markdown
// (providing options and items to the template)
// make that markdown available to the pipeline,
// then insert the rendered HTML into the document
export function templateMarkdownHandler(
  template: string,
  options: TemplateOptions,
  listing: Listing,
  items: ListingItem[],
  attributes?: Record<string, string>,
) {
  // Process the items into simple key value pairs, applying
  // any formatting
  const reshapedItems: Record<string, unknown | undefined>[] = items.map(
    (item) => {
      const record: Record<string, unknown | undefined> = { ...item };
      // TODO: Improve author formatting
      record.author = item.author ? item.author.join(", ") : undefined;

      // Format date values
      // Read date formatting from an option, if present
      const dateFormat = listing.options?.[kDateFormat] as string;

      if (item.date) {
        record.date = dateFormat
          ? format(item.date, dateFormat)
          : item.date.toLocaleDateString();
      }
      if (item.filemodified) {
        record.filemodified = dateFormat
          ? format(item.filemodified, dateFormat)
          : item.filemodified.toLocaleString();
      }

      if (item.description !== undefined) {
        const maxDescLength = listing.options?.[kMaxDescLength] as number ||
          -1;
        if (maxDescLength > 0) {
          record.description = truncateText(item.description, maxDescLength);
        }
      }

      return record;
    },
  );

  // Render the template into markdown
  const markdown = renderEjs(
    resourcePath(template),
    { listing, options, items: reshapedItems },
    false,
  );

  // Return the handler
  return {
    getUnrendered() {
      return {
        blocks: {
          [listing.id]: markdown,
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

      const renderedEl = rendered[listing.id];
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
  options: TemplateOptions,
) {
  // Add sortable values for fields of variant types
  for (const col of Object.keys(options[kColumnTypes])) {
    const type = options[kColumnTypes][col];
    if (type === "date") {
      item.sortableValues[col] = (item[col] as Date).valueOf().toString();
    } else if (type === "number") {
      item.sortableValues[col] = (item[col] as number).toString();
    }
  }

  // Add sortable values for fields that will be linkerd
  options[kColumnLinks].forEach((col) => {
    const val = item[col];
    if (val !== undefined) {
      item.sortableValues[col] = val as string;
    }
  });
}

// Options may also need computation / resolution before being handed
// off to the template. This function will do any computation on the options
// so they're ready for the template
export function resolveTemplateOptions(
  listing: Listing,
): TemplateOptions {
  const baseOptions = () => {
    // resolve options
    const options = (defaultCols: string[]): TemplateOptions => {
      // Raw options from the listing
      const listingOptions = listing.options || {};

      // Computed template options
      const templateOptions = {
        [kColumns]: listingOptions[kColumns] as string[] ||
          defaultCols,
        [kColumnTypes]: {
          ...kDefaultColumnTypes,
          ...(listingOptions[kColumnTypes] as Record<string, ColumnType> ||
            {}),
        },
        [kColumnNames]: {
          ...kDefaultColumnNames,
          ...(listingOptions[kColumnNames] as Record<string, unknown> || {}),
        },
        [kColumnLinks]: listingOptions[kColumnLinks] as string[] ||
          kDefaultColumnLinks,
        [kRowCount]: listingOptions[kRowCount] as number || 100,
        [kAllowFilter]: listingOptions[kAllowFilter] !== undefined
          ? listingOptions[kAllowFilter] as boolean
          : true,
        [kAllowSort]: listingOptions[kAllowSort] !== undefined
          ? listingOptions[kAllowSort] as boolean
          : true,
        [kColumnSortTargets]: {},
      };

      // Return the merged values, retaining the listing options
      // and overwriting any of the values that were computed for the
      // template
      return {
        ...listingOptions,
        ...templateOptions,
      };
    };

    if (listing.type === "table") {
      // Default table options
      return options(kDefaultTableColumns);
    } else if (listing.type === "grid") {
      // Default grid options
      const gridOptions = options(kDefaultGridColumns);
      gridOptions[kColumnCount] = gridOptions[kColumnCount] !== undefined
        ? gridOptions[kColumnCount]
        : 2;
      gridOptions[kCardColumnSpan] = columnSpan(
        gridOptions[kColumnCount] as number,
      );
      gridOptions[kImageHeight] = gridOptions[kImageHeight] || 120;
      return gridOptions;
    } else {
      // Default options
      const defaultOptions = options(kDefaultColumns);
      defaultOptions[kImageAlign] = defaultOptions[kImageAlign] || "right";
      return defaultOptions;
    }
  };
  const options = baseOptions();
  options[kColumnSortTargets] = computeSortingTargets(options);
  return options;
}

// Determine the target value for sorting a field
// Fields need a special sorting target if they are a non-string
// data type (e.g. a number or date), or if they are going to be
// linked (since the 'value' will be surrounded by the href tag, which
// will interfere with sorthing)
function computeSortingTargets(
  options: TemplateOptions,
): Record<string, string> {
  const sortingTargets: Record<string, string> = {};
  const columns = options[kColumns];
  const columnLinks = options[kColumnLinks];
  const columnTypes = options[kColumnTypes];
  columns.forEach((column) => {
    // The data type of this column
    const columnType = columnTypes[column];

    // Figure out whether we should use a sort target or not
    const useTarget = columnLinks.includes(column) ||
      columnType === "date" ||
      columnType === "number";

    if (useTarget) {
      sortingTargets[column] = `${column}-value`;
    } else {
      sortingTargets[column] = column;
    }
  });
  return sortingTargets;
}

// Generates the script tag for this listing / template
// This binds list.js to the listing, enabling
// sorting, pagings, filtering, etc...
export function templateJsScript(
  id: string,
  options: TemplateOptions,
  itemCount: number,
) {
  const columnCount = options[kColumnCount] as number || 0;
  const rowCount = options[kRowCount] as number || 50;

  // If columns are present, factor that in
  const pageCount = columnCount > 0 ? rowCount * columnCount : rowCount;

  const columns = options[kColumns] as string[] || [];

  const pageJs = itemCount > pageCount
    ? `${pageCount ? `page: ${pageCount}` : ""},
    pagination: true,`
    : "";

  const useDataField = (col: string) => {
    const type = options[kColumnTypes][col];
    if (type === "date" || type === "number") {
      return true;
    } else if (options[kColumnLinks].includes(col)) {
      return true;
    }
    return false;
  };

  const formatItem = (col: string) => {
    if (useDataField(col)) {
      return [`"${col}"`, `{ attr: 'data-${col}-value', name: '${col}-value'}`];
    } else {
      return `"${col}"`;
    }
  };

  const rowJs = `[${
    columns.flatMap((col) => {
      return formatItem(col);
    }).join(",")
  }]`;

  const jsScript = `
  window.document.addEventListener("DOMContentLoaded", function (_event) {
    const options = {
      valueNames: ${rowJs},
      ${pageJs}
    };
    const userList = new List("${id}", options);
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
