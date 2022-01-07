/*
* website-listing-shared
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// The core listing type
export interface Listing {
  id: string;
  type: ListingType;
  contents: string[]; // globs
  classes: string[];
  options?: Record<string, unknown>;
  sort?: ListingSort[];
  sortableValueFields: string[];
}

// The type of listing
export enum ListingType {
  Default = "default",
  Grid = "grid",
  Table = "table",
}

export interface ListingSort {
  field: "title" | "author" | "date" | "filename";
  direction: "asc" | "desc";
}

// An individual listing item
export interface ListingItem extends Record<string, unknown> {
  title?: string;
  description?: string;
  author?: string[];
  date?: Date;
  image?: string;
  path: string;
  filename: string;
  filemodified?: Date;
  sortableValues: Record<string, string>;
}
