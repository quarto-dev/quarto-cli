/*
* website-listing-shared
.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname, join, relative } from "path/mod.ts";
import {
  DOMParser,
  Element,
  Node,
  NodeType,
} from "deno_dom/deno-dom-wasm-noinit.ts";

import { kTitle } from "../../../../config/constants.ts";
import { Metadata } from "../../../../config/types.ts";
import { ProjectContext } from "../../../types.ts";
import { kImage } from "../website-constants.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { truncateText } from "../../../../core/text.ts";
import { insecureHash } from "../../../../core/hash.ts";
import { findPreviewImgEl } from "../util/discover-meta.ts";
import { getDecodedAttribute } from "../../../../core/html.ts";

import { kDefaultHighlightStyle } from "../../../../command/render/constants.ts";
import {
  kAbbrevs,
  readTheme,
} from "../../../../quarto-core/text-highlighting.ts";
import { generateCssKeyValues } from "../../../../core/pandoc/css.ts";

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
export const kDefaultMaxDescLength = 175;

// Table options
export const kTableStriped = "table-striped";
export const kTableHover = "table-hover";

// Items to include
export const kInclude = "include";
export const kExclude = "exclude";

// Fields
export const kFieldTitle = "title";
export const kFieldSubtitle = "subtitle";
export const kFieldAuthor = "author";
export const kFieldFileName = "filename";
export const kFieldDateModified = "date-modified";
export const kFieldFileModified = "file-modified";
export const kFieldDate = "date";
export const kFieldImage = "image";
export const kFieldImageAlt = "image-alt";
export const kFieldDescription = "description";
export const kFieldReadingTime = "reading-time";
export const kFieldWordCount = "word-count";
export const kFieldCategories = "categories";
export const kFieldOrder = "order";

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
export const kXmlStyleSheet = "xml-stylesheet";

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
  [kXmlStyleSheet]?: string;
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
  document = "document", // qmd input files
  metadata = "metadata", // yaml metadata files
  metadataDocument = "metadata-document", // yaml containing a list of input files
  rawfile = "rawfile", // some other kind of file that we can't introspect much
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
  previewImage: PreviewImage | undefined;
}

export interface PreviewImage {
  src: string;
  alt?: string;
  title?: string;
}

export const kInlineCodeStyle = "inline-code-style";
export const kUrlsToAbsolute = "urls-to-absolute";

export interface RenderedContentOptions {
  remove?: {
    anchors?: boolean;
    links?: boolean;
    images?: boolean;
  };
  transform?: {
    [kInlineCodeStyle]?: boolean;
    math?: boolean;
    [kUrlsToAbsolute]?: boolean;
  };
  "max-length"?: number;
}

export const renderedContentReader = (
  project: ProjectContext,
  options: RenderedContentOptions,
  siteUrl?: string,
) => {
  const renderedContent: Record<string, RenderedContents> = {};
  return (
    filePath: string,
    renderedOptions?: RenderedContentOptions,
  ): RenderedContents => {
    const cacheStr = renderedOptions
      ? JSON.stringify(renderedOptions) + filePath
      : filePath;
    const cacheHash = insecureHash(cacheStr);
    const mergedOptions = {
      ...options,
      ...renderedOptions,
    };

    if (!renderedContent[cacheHash]) {
      renderedContent[cacheHash] = readRenderedContents(
        filePath,
        project,
        mergedOptions,
        siteUrl,
      );
    }
    return renderedContent[cacheHash];
  };
};

const isWebUrl = (url: string) => {
  return url.startsWith("http:") || url.startsWith("https:");
};

export const absoluteUrl = (siteUrl: string, url: string) => {
  if (isWebUrl(url)) {
    return url;
  } else {
    const baseUrl = siteUrl.endsWith("/")
      ? siteUrl.substring(0, siteUrl.length - 1)
      : siteUrl;
    let path = url.startsWith("/") ? url.substring(1, url.length) : url;
    if (path.endsWith("/index.html")) {
      path = join(dirname(path), "/");
    } else if (path === "index.html") {
      path = "";
    }
    return `${baseUrl}/${path.replaceAll("\\", "/")}`;
  }
};

// This reads a rendered HTML file and extracts its contents.
// The contents will be cleaned to make them conformant to any
// RSS validators (I used W3 validator to identify problematic HTML)
export function readRenderedContents(
  filePath: string,
  project: ProjectContext,
  options: RenderedContentOptions,
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
      (navEl as Element).remove();
    }
  }

  // Convert any images to have absolute paths
  if (options.transform?.[kUrlsToAbsolute] && siteUrl) {
    const imgNodes = doc.querySelectorAll("img");
    if (imgNodes) {
      for (const imgNode of imgNodes) {
        const imgEl = imgNode as Element;
        let src = imgEl.getAttribute("src");
        if (src) {
          if (!src.startsWith("/") && !isWebUrl(src)) {
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
      (node as Element).remove();
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

  // Strip unacceptable tags
  const stripTags = [];
  if (options.remove?.images) {
    stripTags.push("img");
  }
  stripTags.forEach((tag) => {
    const nodes = doc.querySelectorAll(`${tag}`);
    nodes?.forEach((node) => {
      const el = node as Element;
      el.remove();
    });
  });

  if (options.remove?.anchors) {
    // Strip unacceptable links
    const relativeLinkSel = 'a[href^="#"]';
    const linkNodes = doc.querySelectorAll(relativeLinkSel);
    linkNodes.forEach((linkNode) => {
      const nodesToMove = linkNode.childNodes;
      const linkEl = linkNode as Element;
      linkEl.after(...nodesToMove);
      linkEl.remove();
    });
  }

  if (options.transform?.[kInlineCodeStyle]) {
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
  }

  if (options.transform?.math) {
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
  }

  if (options.remove?.links) {
    // String all links
    const relativeLinkSel = "a";
    const linkNodes = doc.querySelectorAll(relativeLinkSel);
    linkNodes.forEach((linkNode) => {
      const nodesToMove = linkNode.childNodes;
      const linkEl = linkNode as Element;
      linkEl.after(...nodesToMove);
      linkEl.remove();
    });
  }

  // Cleans math tags and replaces with qquad
  const replaceTagRegex = /\/tag\{(.*)\}/g;
  const cleanMath = (contents?: string) => {
    if (!contents) {
      return undefined;
    } else {
      // /tag{1}   >   \qquad(1)
      return contents.replaceAll(replaceTagRegex, (_match, content) => {
        return `\\qquad{${content}}`;
      });
    }
  };

  const truncateNode = (node: Node, maxLen?: number) => {
    if (maxLen === undefined || maxLen < 0) {
      return node;
    }

    let currentLength = 0;
    const shortenNode = (node: Node) => {
      const cloned = node.cloneNode(true);
      for (const childNode of cloned.childNodes) {
        if (childNode.nodeType === NodeType.TEXT_NODE) {
          const textNodeLen = childNode.nodeValue?.length || 0;
          if (currentLength > maxLen) {
            cloned.replaceChild(doc.createTextNode(""), childNode);
          } else if (currentLength + textNodeLen > maxLen) {
            const availableChars = maxLen - currentLength;
            cloned.replaceChild(
              doc.createTextNode(
                truncateText(
                  childNode.nodeValue || "",
                  availableChars,
                  "space",
                ),
              ),
              childNode,
            );
          }
          currentLength = textNodeLen + currentLength;
        } else {
          const newNode = shortenNode(childNode);
          cloned.replaceChild(newNode, childNode);
        }
      }

      return cloned;
    };
    return shortenNode(node);
  };

  // Try to find a paragraph that doesn't resolve as completely empty
  // This could happen, for example, if images are removed from the document
  // and  the first paragraph is an image.
  const getFirstPara = () => {
    const paraNodes = mainEl?.querySelectorAll("p");
    if (paraNodes) {
      for (const paraNode of paraNodes) {
        const truncatedNode = truncateNode(paraNode, options["max-length"]);
        const paraContents = cleanMath((truncatedNode as Element).innerHTML);
        if (paraContents) {
          return paraContents;
        }
      }
    }

    // We couldn't find any paragraphs. Instead just grab the first non-empty element
    // and use that instead
    const anyNodes = mainEl?.childNodes;
    if (anyNodes) {
      for (const anyNode of anyNodes) {
        if (anyNode.nodeType === 1) { // element node
          const el = anyNode as Element;
          const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6");
          headings.forEach((heading) => (heading as Element).remove());

          const truncatedNode = truncateNode(anyNode, options["max-length"]);
          const contents = cleanMath((truncatedNode as Element).innerHTML);
          if (contents) {
            return contents;
          }
        }
      }
    }

    return undefined;
  };

  // Find a preview image, if present
  const computePreviewImage = (): PreviewImage | undefined => {
    const previewImageEl = findPreviewImgEl(doc, false);
    if (previewImageEl) {
      const previewImageSrc = getDecodedAttribute(previewImageEl, "src");
      if (previewImageSrc !== null) {
        const src = previewImageSrc;
        const alt = previewImageEl.getAttribute("alt") !== null
          ? previewImageEl.getAttribute("alt") as string
          : undefined;
        const title = previewImageEl.getAttribute("title") !== null
          ? previewImageEl.getAttribute("title") as string
          : undefined;
        return {
          src,
          alt,
          title,
        };
      }
    }
  };
  // Clean and fetch data
  const firstPara = getFirstPara();
  const fullContents = cleanMath(mainEl?.innerHTML);

  return {
    title: titleText,
    fullContents,
    firstPara,
    previewImage: computePreviewImage(),
  };
}

const kWebTexUrl = (
  math: string,
  type: "png" | "svg" | "gif" | "emf" | "pdf" = "png",
) => {
  const encodedMath = encodeURI(math);
  return `https://latex.codecogs.com/${type}.latex?${encodedMath}`;
};

export function defaultSyntaxHighlightingClassMap() {
  const classToStyleMapping: Record<string, string[]> = {};

  // Read the highlight style (theme name)
  const theme = kDefaultHighlightStyle;
  const themeRaw = readTheme("", theme, "default");
  if (themeRaw) {
    const themeJson = JSON.parse(themeRaw);

    // Generates CSS rules based upon the syntax highlighting rules in a theme file
    const textStyles = themeJson["text-styles"] as Record<
      string,
      Record<string, unknown>
    >;
    if (textStyles) {
      Object.keys(textStyles).forEach((styleName) => {
        const abbr = kAbbrevs[styleName];
        if (abbr !== undefined) {
          const textValues = textStyles[styleName];
          const cssValues = generateCssKeyValues(textValues);
          classToStyleMapping[abbr] = cssValues;
        }
      });
    }
  }
  return classToStyleMapping;
}
