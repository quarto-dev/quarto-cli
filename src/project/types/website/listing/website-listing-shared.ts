/*
* website-listing-shared
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kTitle } from "../../../../config/constants.ts";
import { Metadata } from "../../../../config/types.ts";
import { kImage } from "../website-config.ts";

// The list of columns to display
export const kFields = "fields";

// A record providing formatted names for columns
export const kFieldDisplayNames = "field-display-names";

// a record providing a column to type mapping
export const kFieldTypes = "field-types";

// The list of columns to show as hyperlinks
export const kFieldLinks = "field-links";

// The list of required fields for this listing
export const kFieldRequired = "field-required";

// The list of columns to include as sortable
export const kFieldSort = "field-sort";

// The list of columns to include as filterable
export const kFieldFilter = "field-filter";

// The number of rows to display per page
export const kPageSize = "page-size";

// Configuration of the filtering and sorting options
export const kFilterUi = "filter-ui";
export const kSortUi = "sort-ui";

// The Image Height / Alignment
export const kImageHeight = "image-height";

// Only for the default style listing
export const kImageAlign = "image-align";

// The number of columns to display (grid)
export const kGridColumns = "grid-columns";

// The maximum length of the description
export const kMaxDescLength = "max-description-length";

// Table options
export const kTableStriped = "table-striped";
export const kTableHover = "table-hover";

// Fields
export const kFieldTitle = "title";
export const kFieldSubtitle = "subtitle";
export const kFieldAuthor = "author";
export const kFieldFileName = "filename";
export const kFieldFileModified = "file-modified";
export const kFieldDate = "date";
export const kFieldImage = "image";
export const kFieldDescription = "description";
export const kFieldReadingTime = "reading-time";
export const kFieldCategories = "categories";

// Shared options
export const kCategoryStyle = "category-style";

// Sort keys
export const kSortAsc = "asc";
export const kSortDesc = "desc";

// Feed options
export const kFeed = "feed";
export const kItems = "items";
export const kType = "type";
export const kLanguage = "language";
export const kDescription = "description";

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

export interface ListingFeedOptions {
  [kTitle]?: string;
  [kItems]?: number;
  [kType]: "summary" | "full";
  [kDescription]?: string;
  [kFieldCategories]?: string[];
  [kImage]?: string;
  [kLanguage]?: string;
}

export interface ListingSharedOptions {
  [kFieldCategories]: boolean;
  [kCategoryStyle]: CategoryStyle;
  [kFeed]?: ListingFeedOptions;
}

// The core listing type
export interface Listing extends ListingDehydrated {
  fields: string[];
  [kFieldDisplayNames]: Record<string, string>;
  [kFieldTypes]: Record<string, ColumnType>;
  [kFieldLinks]: string[];
  [kFieldSort]: string[];
  [kFieldFilter]: string[];
  [kFieldRequired]: string[];
  [kPageSize]: number;
  [kFilterUi]: boolean;
  [kSortUi]: boolean;

  sort?: ListingSort[];
  template?: string;

  // Computed values
  [kGridColumns]?: number;
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
  [kFieldFileModified]?: Date;
  sortableValues?: Record<string, string>;
}
