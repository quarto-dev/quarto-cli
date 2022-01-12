/*
* website-listing-shared
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Metadata } from "../../../../config/types.ts";

// The list of columns to display
export const kColumns = "columns";

// A record providing formatted names for columns
export const kColumnNames = "column-names";

// The list of columns to show as hyperlinks
export const kColumnLinks = "column-links";

// The list of columns to include as sortable
export const kColumnSort = "column-sort";

// a record providing a column to type mapping
export const kColumnTypes = "column-types";

// A computed record that provides the name of the sort target
// for a column (so that the columns can be sorted by a different)
// value than what is displayed (for example, dates)
export const kColumnSortTargets = "column-sort-targets";

// The number of rows to display per page
export const kRowCount = "row-count";

// Configuration of the filtering and sorting options
export const kShowFilter = "show-filter";
export const kShowSort = "show-sort";

// The Image Height / Alignment
export const kImageHeight = "image-height";
export const kImageAlign = "image-align";

// The number of columns to display (grid)
export const kColumnCount = "column-count";

export interface ResolvedListing {
  listing: Listing;
  items: ListingItem[];
}

// The core listing type
export interface Listing extends Record<string, unknown> {
  id: string;
  type: ListingType;
  contents: Array<string | Metadata>; // globs (or items)
  columns: string[];
  [kColumnNames]: Record<string, string>;
  [kColumnTypes]: Record<string, ColumnType>;
  [kColumnLinks]: string[];
  [kColumnSort]: string[];
  [kRowCount]: number;
  [kShowFilter]: boolean;
  [kShowSort]: boolean;
  sort?: ListingSort[];
  classes?: string[];
  template?: string;

  // Computed values
  [kColumnSortTargets]?: Record<string, string>;
  [kColumnCount]?: number;
}

// The type of listing
export enum ListingType {
  Default = "default",
  Grid = "grid",
  Table = "table",
  Custom = "custom",
}

// Listing sorting
export interface ListingSort {
  column: "title" | "author" | "date" | "filename" | string;
  direction: "asc" | "desc";
}

// Column Types
export type ColumnType = "date" | "string" | "number";

// An individual listing item
export interface ListingItem extends Record<string, unknown> {
  title?: string;
  subtitle?: string;
  description?: string;
  author?: string[];
  date?: Date;
  image?: string;
  path?: string;
  filename?: string;
  filemodified?: Date;
  sortableValues?: Record<string, string>;
}
