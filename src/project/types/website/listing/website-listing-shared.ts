/*
* website-listing-shared
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, relative } from "path/mod.ts";
import { DOMParser, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  defaultSyntaxHighlightingClassMap,
} from "../../../../command/render/pandoc-html.ts";

import { kTitle } from "../../../../config/constants.ts";
import { Metadata } from "../../../../config/types.ts";
import { ProjectContext } from "../../../types.ts";
import { kImage } from "../website-constants.ts";
import { projectOutputDir } from "../../../project-shared.ts";

// The root listing key
export const kListing = "listing";

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

// The maximum number of items to include
export const kMaxItems = "max-items";

// Configuration of the filtering and sorting options
export const kFilterUi = "filter-ui";
export const kSortUi = "sort-ui";

// The Image Height / Alignment
export const kImageHeight = "image-height";

// Only for the default style listing
export const kImageAlign = "image-align";

// Alt text for the item's image
export const kImageAlt = "image-alt";

// The placeholder image for the item
export const kImagePlaceholder = "image-placeholder";

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
export const kFieldImageAlt = "image-alt";
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
  [kFieldCategories]?: string | string[];
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
  [kMaxItems]?: number;
  [kFilterUi]: boolean;
  [kSortUi]: boolean;
  [kImagePlaceholder]?: string;

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
  rawfile = "rawfile",
}

// An individual listing item
export interface ListingItem extends Record<string, unknown> {
  title?: string;
  subtitle?: string;
  description?: string;
  author?: string[];
  date?: Date;
  image?: string;
  [kImageAlt]?: string;
  path?: string;
  filename?: string;
  [kFieldFileModified]?: Date;
  sortableValues?: Record<string, string>;
}

export interface RenderedContents {
  title: string | undefined;
  firstPara: string | undefined;
  fullContents: string | undefined;
}

export const renderedContentReader = (
  project: ProjectContext,
  forFeed: boolean,
  siteUrl?: string,
) => {
  const renderedContent: Record<string, RenderedContents> = {};
  return (filePath: string): RenderedContents => {
    if (!renderedContent[filePath]) {
      renderedContent[filePath] = readRenderedContents(
        filePath,
        project,
        forFeed,
        siteUrl,
      );
    }
    return renderedContent[filePath];
  };
};

export const absoluteUrl = (siteUrl: string, url: string) => {
  if (url.startsWith("http:") || url.startsWith("https:")) {
    return url;
  } else {
    return `${siteUrl}/${url}`;
  }
};

// This reads a rendered HTML file and extracts its contents.
// The contents will be cleaned to make them conformant to any
// RSS validators (I used W3 validator to identify problematic HTML)
export function readRenderedContents(
  filePath: string,
  project: ProjectContext,
  forFeed: boolean,
  siteUrl?: string,
): RenderedContents {
  const htmlInput = Deno.readTextFileSync(filePath);
  const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;

  const fileRelPath = relative(projectOutputDir(project), filePath);
  const fileRelFolder = dirname(fileRelPath);

  const mainEl = doc.querySelector("main.content");

  // Capture the rendered title and remove it from the content
  const titleEl = doc.getElementById("title-block-header");
  const titleText = titleEl?.querySelector("h1.title")?.innerText;
  if (titleEl) {
    titleEl.remove();
  }

  // Remove any navigation elements from the content region
  const navEls = doc.querySelectorAll("nav");
  if (navEls) {
    for (const navEl of navEls) {
      navEl.remove();
    }
  }

  // Convert any images to have absolute paths
  if (forFeed && siteUrl) {
    const imgNodes = doc.querySelectorAll("img");
    if (imgNodes) {
      for (const imgNode of imgNodes) {
        const imgEl = imgNode as Element;
        let src = imgEl.getAttribute("src");
        if (src) {
          if (!src.startsWith("/")) {
            src = join(fileRelFolder, src);
          }
          imgEl.setAttribute("src", absoluteUrl(siteUrl, src));
        }
      }
    }
  }

  // Strip unacceptable elements
  const stripSelectors = [
    '*[aria-hidden="true"]', // Feeds should not contain aria hidden elements
    "button.code-copy-button", // Code copy buttons looks weird and don't work
  ];
  stripSelectors.forEach((sel) => {
    const nodes = doc.querySelectorAll(sel);
    nodes?.forEach((node) => {
      node.remove();
    });
  });

  // Strip unacceptable attributes
  const stripAttrs = [
    "role",
  ];
  stripAttrs.forEach((attr) => {
    const nodes = doc.querySelectorAll(`[${attr}]`);
    nodes?.forEach((node) => {
      const el = node as Element;
      el.removeAttribute(attr);
    });
  });

  if (forFeed) {
    // String unacceptable links
    const relativeLinkSel = 'a[href^="#"]';
    const linkNodes = doc.querySelectorAll(relativeLinkSel);
    linkNodes.forEach((linkNode) => {
      const nodesToMove = linkNode.childNodes;
      linkNode.after(...nodesToMove);
      linkNode.remove();
    });

    // Process code to apply styles for syntax highlighting
    const highlightingMap = defaultSyntaxHighlightingClassMap();
    const spanNodes = doc.querySelectorAll("code span");
    for (const spanNode of spanNodes) {
      const spanEl = spanNode as Element;

      for (const clz of spanEl.classList) {
        const styles = highlightingMap[clz];
        if (styles) {
          spanEl.setAttribute("style", styles.join("\n"));
          break;
        }
      }
    }

    // Apply a code background color
    const codeStyle = "background: #f1f3f5;";
    const codeBlockNodes = doc.querySelectorAll("div.sourceCode");
    for (const codeBlockNode of codeBlockNodes) {
      const codeBlockEl = codeBlockNode as Element;
      codeBlockEl.setAttribute("style", codeStyle);
    }

    // Process math using webtex
    const trimMath = (str: string) => {
      // Text of math is prefixed by the below
      if (str.length > 4 && (str.startsWith("\\[") || str.startsWith("\\("))) {
        const trimStart = str.slice(2);
        return trimStart.slice(0, trimStart.length - 2);
      } else {
        return str;
      }
    };
    const mathNodes = doc.querySelectorAll("span.math");
    for (const mathNode of mathNodes) {
      const mathEl = mathNode as Element;
      const math = trimMath(mathEl.innerText);
      const imgEl = doc.createElement("IMG");
      imgEl.setAttribute(
        "src",
        kWebTexUrl(math),
      );
      mathNode.parentElement?.replaceChild(imgEl, mathNode);
    }
  } else {
    // String all links
    const relativeLinkSel = "a";
    const linkNodes = doc.querySelectorAll(relativeLinkSel);
    linkNodes.forEach((linkNode) => {
      const nodesToMove = linkNode.childNodes;
      linkNode.after(...nodesToMove);
      linkNode.remove();
    });
  }

  return {
    title: titleText,
    fullContents: mainEl?.innerHTML,
    firstPara: mainEl?.querySelector("p")?.innerHTML,
  };
}

const kWebTexUrl = (
  math: string,
  type: "png" | "svg" | "gif" | "emf" | "pdf" = "png",
) => {
  const encodedMath = encodeURI(math);
  return `https://latex.codecogs.com/${type}.latex?${encodedMath}`;
};
