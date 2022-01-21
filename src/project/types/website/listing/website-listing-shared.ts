/*
* website-listing-shared
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Metadata } from "../../../../config/types.ts";

// The list of columns to display
export const kFields = "fields";

// A record providing formatted names for columns
export const kFieldsName = "fields-name";

// a record providing a column to type mapping
export const kFieldsType = "fields-type";

// The list of columns to show as hyperlinks
export const kFieldsLink = "fields-link";

// The list of required fields for this listing
export const kFieldsRequired = "fields-required";

// The list of columns to include as sortable
export const kFieldsSort = "fields-sort";

// The number of rows to display per page
export const kRowCount = "row-count";

// Configuration of the filtering and sorting options
export const kShowFilter = "show-filter";
export const kShowSort = "show-sort";

// The Image Height / Alignment
export const kImageHeight = "image-height";

// Only for the default style listing
export const kImageAlign = "image-align";

// The number of columns to display (grid)
export const kColumnCount = "column-count";

// The maximum length of the description
export const kMaxDescLength = "max-description-length";

// Fields
export const kFieldTitle = "title";
export const kFieldSubtitle = "subtitle";
export const kFieldAuthor = "author";
export const kFieldFileModified = "filemodified";
export const kFieldFileName = "filename";
export const kFieldDate = "date";
export const kFieldImage = "image";
export const kFieldDescription = "description";
export const kFieldReadingTime = "readingtime";
export const kFieldCategories = "categories";

export const kPageColumn = "page-column";
export const kCategoryStyle = "category-style";

// Sort keys
export const kSortAsc = "asc";
export const kSortDesc = "desc";

export interface ListingDescriptor {
  listing: Listing;
  items: ListingItem[];
}

export interface ListingDehydrated extends Record<string, unknown> {
  id: string;
  type: ListingType;
  contents: Array<string | Metadata>; // globs (or items)
}

export type CategoryStyle =
  | "category-default"
  | "category-unnumbered"
  | "category-cloud";

export interface ListingSharedOptions {
  [kFieldCategories]: boolean;
  [kPageColumn]?: string;
  [kCategoryStyle]: CategoryStyle;
}

// The core listing type
export interface Listing extends ListingDehydrated {
  fields: string[];
  [kFieldsName]: Record<string, string>;
  [kFieldsType]: Record<string, ColumnType>;
  [kFieldsLink]: string[];
  [kFieldsSort]: string[];
  [kFieldsRequired]: string[];
  [kRowCount]: number;
  [kShowFilter]: boolean;
  [kShowSort]: boolean;

  sort?: ListingSort[];
  classes?: string[];
  template?: string;

  // Computed values
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
  field: "title" | "author" | "date" | "filename" | string;
  direction: "asc" | "desc";
}

// Column Types
export type ColumnType = "date" | "string" | "number" | "minutes";

// Sources that provide Listing Items
export enum ListingItemSource {
  document = "document",
  metadata = "metadata",
}

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
