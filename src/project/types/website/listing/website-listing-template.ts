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
import { Listing, ListingItem } from "./website-list-shared.ts";

export const kColumns = "columns";
export const kColumnNames = "column-names";
export const kColumnLinks = "column-links";
export const kColumnTypes = "column-types";
export const kColumnSortTargets = "column-sort-targets";

export const kRows = "rows";
export const kAllowFilter = "allow-filter";
export const kAllowSort = "allow-sort";

export const kDateFormat = "date-format";

export type ColumnType = "date" | "string" | "number";

const kDefaultColumns = ["date", "title", "author", "filename"];
const kDefaultColumnLinks = ["title", "filename"];
// TODO: Localize
const kDefaultColumnNames = {
  "date": "Date",
  "title": "Title",
  "description": "Description",
  "author": "Author",
  "filename": "File Name",
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
}

export interface TableTemplateOptions extends TemplateOptions {
  [kRows]: number;
  [kAllowFilter]: boolean;
  [kAllowSort]: boolean;
}

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
      listing.classes.forEach((clz) => listingEl?.classList.add(clz));

      // Add attributes
      if (attributes) {
        Object.keys(attributes).forEach((attrName) => {
          listingEl?.setAttribute(attrName, attributes[attrName]);
        });
      }

      const renderedEl = rendered[listing.id];
      for (const child of renderedEl.children) {
        listingEl?.appendChild(child);
      }
    },
  };
}

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

export function resolveTemplateOptions(
  listing: Listing,
): TableTemplateOptions | TemplateOptions {
  const baseOptions = () => {
    if (listing.type === "table") {
      return {
        [kColumns]: listing.options?.[kColumns] as string[] || kDefaultColumns,
        [kColumnTypes]: {
          ...kDefaultColumnTypes,
          ...(listing.options?.[kColumnTypes] as Record<string, ColumnType> ||
            {}),
        },
        [kColumnNames]: {
          ...kDefaultColumnNames,
          ...(listing.options?.[kColumnNames] as Record<string, unknown> || {}),
        },
        [kColumnLinks]: listing.options?.[kColumnLinks] as string[] ||
          kDefaultColumnLinks,
        [kRows]: listing.options?.[kRows] as number || 100,
        [kAllowFilter]: listing.options?.[kAllowFilter] !== undefined
          ? listing.options?.[kAllowFilter]
          : true,
        [kAllowSort]: listing.options?.[kAllowSort] !== undefined
          ? listing.options?.[kAllowSort]
          : true,
        [kColumnSortTargets]: {},
      };
    }
    return {
      [kColumns]: kDefaultColumns,
      [kColumnNames]: kDefaultColumnNames,
      [kColumnLinks]: kDefaultColumnLinks,
      [kColumnTypes]: kDefaultColumnTypes,
      [kColumnSortTargets]: {},
    };
  };
  const options = baseOptions();
  options[kColumnSortTargets] = computeSortingTargets(options);
  return options;
}

function computeSortingTargets(
  options: TemplateOptions,
): Record<string, string> {
  const sortingTargets: Record<string, string> = {};
  const columns = options[kColumns];
  const columnLinks = options[kColumnLinks];
  const columnTypes = options[kColumnTypes];
  columns.forEach((column) => {
    const columnType = columnTypes[column];
    // Will this column be linked?
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

export function templateJsScript(
  id: string,
  options: TemplateOptions,
  itemCount: number,
) {
  const rows = options[kRows] as number || 50;
  const columns = options[kColumns] as string[] || [];

  const pageJs = itemCount > rows
    ? `${rows ? `page: ${rows}` : ""},
    pagination: false,`
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
