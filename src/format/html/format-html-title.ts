/*
* format-html-title.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, isAbsolute, join } from "path/mod.ts";
import {
  kAuthor,
  kTitleBlockAffiliationPlural,
  kTitleBlockAffiliationSingle,
  kTitleBlockAuthorPlural,
  kTitleBlockAuthorSingle,
  kTitleBlockPublished,
} from "../../config/constants.ts";
import { localizedString } from "../../config/localization.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { Author, parseAuthor } from "../../core/author.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import { kDescription } from "../../project/types/website/listing/website-listing-shared.ts";
import {
  citationMeta,
  documentCSL,
  formattedDocumentDate,
} from "../../quarto-core/attribution/document.ts";

const kDoiBadge = false;
const kTitleBlockStyle = "title-block-style";
const kTitleBlockBanner = "title-block-banner";
const ktitleBlockColor = "title-block-banner-color";
const kTitleBlockCategories = "title-block-categories";

const orcidData =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1N0NEMjA4MDI1MjA2ODExOTk0QzkzNTEzRjZEQTg1NyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDozM0NDOEJGNEZGNTcxMUUxODdBOEVCODg2RjdCQ0QwOSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDozM0NDOEJGM0ZGNTcxMUUxODdBOEVCODg2RjdCQ0QwOSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IE1hY2ludG9zaCI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkZDN0YxMTc0MDcyMDY4MTE5NUZFRDc5MUM2MUUwNEREIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjU3Q0QyMDgwMjUyMDY4MTE5OTRDOTM1MTNGNkRBODU3Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+84NovQAAAR1JREFUeNpiZEADy85ZJgCpeCB2QJM6AMQLo4yOL0AWZETSqACk1gOxAQN+cAGIA4EGPQBxmJA0nwdpjjQ8xqArmczw5tMHXAaALDgP1QMxAGqzAAPxQACqh4ER6uf5MBlkm0X4EGayMfMw/Pr7Bd2gRBZogMFBrv01hisv5jLsv9nLAPIOMnjy8RDDyYctyAbFM2EJbRQw+aAWw/LzVgx7b+cwCHKqMhjJFCBLOzAR6+lXX84xnHjYyqAo5IUizkRCwIENQQckGSDGY4TVgAPEaraQr2a4/24bSuoExcJCfAEJihXkWDj3ZAKy9EJGaEo8T0QSxkjSwORsCAuDQCD+QILmD1A9kECEZgxDaEZhICIzGcIyEyOl2RkgwAAhkmC+eAm0TAAAAABJRU5ErkJggg==";

// TODO:
// if banner === true, emit class on title block that uses navbar color + auto detection of text color
// if banner === image, emit class on title block that uses body-bg color for text
// if banner === color, emit style tag that sets banner color
// if

export function processDocumentTitle(
  input: string,
  format: Format,
  _flags: PandocFlags,
  doc: Document,
  offset?: string,
) {
  // Don't do anything at all if the appendix-style is false or 'none'
  if (
    format.metadata.book || // It never makes sense to process the appendix when we're in a book
    format.metadata[kTitleBlockStyle] === false ||
    format.metadata[kTitleBlockStyle] === "none"
  ) {
    return [];
  }

  const resources: string[] = [];

  // Sort out the title block style
  const computeTitleBlockStyle = (format: Format) => {
    const titleBlockStyle = format.metadata[kTitleBlockStyle] as string;
    if (titleBlockStyle) {
      return titleBlockStyle;
    } else {
      return "default";
    }
  };
  const titleBlockStyle = computeTitleBlockStyle(format);

  // The documentation citation information for this document
  const csl = documentCSL(input, format, "webpage", offset);

  // Capture existing header
  const headerEl = doc.querySelector("header#title-block-header");

  // Read the basic metadata that we'll use
  const titleEl = headerEl?.querySelector(".title");
  const subTitleEl = headerEl?.querySelector(".subtitle");
  const dateEl = headerEl?.querySelector(".date");

  // Remove the doi, we'll deal with this ourselves
  const doiEl = headerEl?.querySelector(".doi");
  doiEl?.remove();

  // Read the authors and remove them
  // We'll generate them ourselves below
  const authorNodeList = headerEl?.querySelectorAll(".author");
  authorNodeList?.forEach((node) => {
    node.remove();
  });

  // Process the title
  const titleContainerEl = doc.createElement("div");
  titleContainerEl.classList.add("quarto-title");
  if (titleEl) {
    titleContainerEl.appendChild(titleEl);
  }
  if (subTitleEl) {
    titleContainerEl.appendChild(subTitleEl);
  }
  if (format.metadata[kDescription]) {
    // Create an element for the description
    titleContainerEl.appendChild(createDescriptionEl(doc, format));
  }

  // Create a container for the grid of metadata
  const metadataContainerEl = doc.createElement("div");
  metadataContainerEl.classList.add("quarto-title-meta");

  // Generate the authors section
  const authorMeta = format.metadata[kAuthor] || citationMeta(format)[kAuthor];
  const authors: Author[] = [];
  if (authorMeta) {
    const parsedAuthors = parseAuthor(authorMeta);
    if (parsedAuthors) {
      authors.push(...parsedAuthors);
    }
  }

  // Process the authors and affiliations
  if (authors.length > 0) {
    const hasAffiliations = authors.find((auth) =>
      auth.affilliation !== undefined
    );
    const authorEl = doc.createElement("div");
    authorEl.classList.add("quarto-title-authors");
    for (const author of authors) {
      const authorP = doc.createElement("p");

      const authorContentsNode = maybeLinkedNode(doc, author.name, author.url);
      authorP.appendChild(authorContentsNode);

      if (author.orcid) {
        const orcidImg = doc.createElement("img");
        orcidImg.setAttribute("src", orcidData);

        const orcidLink = doc.createElement("a");
        orcidLink.classList.add("quarto-title-author-orcid");
        orcidLink.setAttribute("href", `https://orcid.org/${author.orcid}`);
        orcidLink.appendChild(doc.createTextNode(" "));
        orcidLink.appendChild(orcidImg);

        authorP.appendChild(orcidLink);
      }

      authorEl.appendChild(authorP);
    }
    const authorTitle = authors.length === 1
      ? localizedString(format, kTitleBlockAuthorSingle)
      : localizedString(format, kTitleBlockAuthorPlural);
    const authorContainer = metadataEl(
      doc,
      authorTitle,
      [authorEl],
    );
    metadataContainerEl.appendChild(authorContainer);

    if (hasAffiliations) {
      const affiliationEl = doc.createElement("div");
      affiliationEl.classList.add("quarto-title-affiliations");
      for (const author of authors) {
        const affiliationP = doc.createElement("p");

        const affiliationText = (author.affilliation !== undefined)
          ? author.affilliation.name
          : "";

        const affiliationNode = maybeLinkedNode(
          doc,
          affiliationText,
          author.affilliation?.url,
        );
        affiliationP.appendChild(affiliationNode);
        affiliationEl.appendChild(affiliationP);
      }
      const affiliationContainer = metadataEl(
        doc,
        authors.length === 1
          ? localizedString(format, kTitleBlockAffiliationSingle)
          : localizedString(format, kTitleBlockAffiliationPlural),
        [
          affiliationEl,
        ],
      );
      metadataContainerEl.appendChild(affiliationContainer);
    }
  }

  // Process the publish date
  if (dateEl) {
    const formatted = formattedDocumentDate(format, "long");
    if (formatted) {
      dateEl.innerText = formatted;
    }

    const dateContainer = metadataEl(
      doc,
      localizedString(format, kTitleBlockPublished),
      [dateEl],
    );
    metadataContainerEl.appendChild(dateContainer);
  }

  // Process the DOI
  if (csl.DOI) {
    metadataContainerEl.appendChild(
      createDOIMetadataEl(doc, csl.DOI, kDoiBadge),
    );
  }

  // Add title and metadata to the header
  headerEl?.classList.add("quarto-title-block");
  headerEl?.classList.add(titleBlockStyle);

  // Resolves any banner path
  const banner = format.metadata[kTitleBlockBanner] as string | boolean;
  if (banner) {
    const bannerStyles: string[] = [];

    const titleColor = (block: unknown) => {
      if (block === "body" || block === "body-bg") {
        return undefined;
      } else {
        return block;
      }
    };

    const titleColorClass = (block: unknown) => {
      if (block === "body") {
        return "body";
      } else if (block === "body-bg") {
        return "body-bg";
      } else {
        return "none";
      }
    };

    const titleBlockColor = titleColor(format.metadata[ktitleBlockColor]);
    if (titleBlockColor) {
      bannerStyles.push(`color: ${titleBlockColor};`);
    }

    if (banner === true) {
      headerEl?.appendChild(createBannerEl(
        doc,
        titleContainerEl,
        "navbar",
      ));
    } else if (isBannerImage(input, banner)) {
      resources.push(banner as string);
      headerEl?.appendChild(
        createBannerEl(
          doc,
          titleContainerEl,
          "body-bg",
          `background-image: url('${banner}'); background-size: cover;`,
        ),
      );
    } else {
      headerEl?.appendChild(
        createBannerEl(
          doc,
          titleContainerEl,
          titleColorClass(format.metadata[ktitleBlockColor]),
        ),
      );
      bannerStyles.push(`background-color: ${banner};`);
    }

    if (bannerStyles.length > 0) {
      createTitleBannerStyleInHead(doc, bannerStyles);
    }
  } else {
    headerEl?.appendChild(titleContainerEl);
  }

  // Process any categories
  const categoriesEnabled = format.metadata[kTitleBlockCategories] !== undefined
    ? format.metadata[kTitleBlockCategories]
    : true;

  if (categoriesEnabled) {
    const categories = format.metadata?.categories
      ? Array.isArray(format.metadata?.categories)
        ? format.metadata?.categories
        : [format.metadata?.categories]
      : undefined;

    if (categories) {
      if (banner) {
        titleContainerEl?.appendChild(createCategoriesEl(doc, categories));
      } else {
        headerEl?.appendChild(createCategoriesEl(doc, categories));
      }
    }
  }

  // Process metadata
  if (metadataContainerEl.hasChildNodes()) {
    headerEl?.appendChild(metadataContainerEl);
  }

  // Place the abstract or description
  const abstractEl = headerEl?.querySelector(".abstract");
  if (abstractEl) {
    // move the abstract to the bottom
    abstractEl.remove();
    headerEl?.appendChild(abstractEl);
  }

  return resources;
}

function createDescriptionEl(doc: Document, format: Format) {
  const descriptionEl = doc.createElement("div");
  descriptionEl.classList.add("quarto-description");
  const descriptionP = doc.createElement("p");
  descriptionP.innerText = format.metadata[kDescription] as string;
  descriptionEl.appendChild(descriptionP);
  return descriptionEl;
}

function createCategoriesEl(doc: Document, categories: string[]) {
  const categoryContainerEl = doc.createElement("div");
  categoryContainerEl.classList.add("quarto-categories");
  categories.forEach((category) => {
    const categoryEl = doc.createElement("div");
    categoryEl.classList.add("quarto-category");
    categoryEl.innerText = category;
    categoryContainerEl.appendChild(categoryEl);
  });
  return categoryContainerEl;
}

function createDOIMetadataEl(doc: Document, doi: string, badge: boolean) {
  const doiUrl = `https://doi.org/${doi}`;
  const doiLinkEl = doc.createElement("a");
  doiLinkEl.setAttribute("href", doiUrl);

  if (badge) {
    const doiBadge = doc.createElement("img");
    doiBadge.setAttribute(
      "src",
      `https://zenodo.org/badge/DOI/${doi}.svg`,
    );
    doiLinkEl.appendChild(doiBadge);
  } else {
    doiLinkEl.innerText = doi;
  }

  return metadataEl(doc, kDoiBadge ? "" : "DOI", [doiLinkEl]);
}

function isBannerImage(input: string, banner: unknown) {
  if (typeof (banner) === "string") {
    let path;

    if (isAbsolute(banner)) {
      path = banner;
    } else {
      path = join(dirname(input), banner);
    }
    return existsSync(path);
  } else {
    return false;
  }
}

function createTitleBannerStyleInHead(doc: Document, styles: string[]) {
  const bannerStyle = doc.createElement("style");
  bannerStyle.setAttribute("type", "text/css");
  bannerStyle.innerText = `
  main.quarto-banner-title-block .quarto-title-banner {
    ${styles.join("\n")}
  }`;
  const head = doc.querySelector("head");
  head?.appendChild(bannerStyle);
}

function createBannerEl(
  doc: Document,
  titleContainerEl: Element,
  color: "navbar" | "body" | "body-bg" | "none",
  style?: string,
) {
  const mainEl = doc.querySelector("main.content");
  mainEl?.classList.add("quarto-banner-title-block");

  const bannerDiv = doc.createElement("div");
  bannerDiv.setAttribute("data-toc-align", "true");
  bannerDiv.classList.add("quarto-title-banner");
  if (color === "navbar") {
    bannerDiv.classList.add("color-navbar");
  } else if (color === "body-bg" || color === "body") {
    bannerDiv.classList.add(`color-${color}`);
  }
  if (style) {
    bannerDiv.setAttribute(
      "style",
      style,
    );
  }
  titleContainerEl.classList.add("column-body");
  bannerDiv.appendChild(titleContainerEl);
  return bannerDiv;
}

function maybeLinkedNode(doc: Document, text: string, url?: string) {
  if (url) {
    const affiliationA = doc.createElement("a");
    affiliationA.setAttribute("href", url);
    affiliationA.innerText = text;
    return affiliationA;
  } else {
    return doc.createTextNode(text);
  }
}

function metadataEl(doc: Document, title: string, els: Element[]) {
  const divEl = doc.createElement("div");

  const titleEl = doc.createElement("div");
  titleEl.classList.add("quarto-title-meta-heading");
  titleEl.innerText = title;

  const contentsEl = doc.createElement("div");
  contentsEl.classList.add("quarto-title-meta-contents");
  for (const el of els) {
    contentsEl.appendChild(el);
  }

  divEl.appendChild(titleEl);
  divEl.appendChild(contentsEl);
  return divEl;
}
