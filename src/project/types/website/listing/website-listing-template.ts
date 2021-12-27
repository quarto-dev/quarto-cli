/*
* website-listing-template
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Listing, ListingItem } from "./website-list-shared.ts";

export const kColumns = "columns";
export const kColumnNames = "column-names";
export const kColumnLinks = "column-links";
export const kColumnTypes = "column-types";

export const kRows = "rows";
export const kAllowFilter = "allow-filter";
export const kAllowSort = "allow-sort";

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
}

export interface TableTemplateOptions extends TemplateOptions {
  [kRows]: number;
  [kAllowFilter]: boolean;
  [kAllowSort]: boolean;
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
    };
  }
  return {
    [kColumns]: kDefaultColumns,
    [kColumnNames]: kDefaultColumnNames,
    [kColumnLinks]: kDefaultColumnLinks,
    [kColumnTypes]: kDefaultColumnTypes,
  };
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
