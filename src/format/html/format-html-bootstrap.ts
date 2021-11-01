/*
* format-html-bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { join } from "path/mod.ts";

import { renderEjs } from "../../core/ejs.ts";
import { formatResourcePath } from "../../core/resources.ts";

import {
  kHtmlMathMethod,
  kLinkCitations,
  kSectionDivs,
  kTheme,
  kTocTitle,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  Metadata,
} from "../../config/types.ts";
import { isHtmlOutput } from "../../config/format.ts";
import { PandocFlags } from "../../config/types.ts";
import {
  hasTableOfContents,
  hasTableOfContentsTitle,
} from "../../config/toc.ts";

import { resolveBootstrapScss } from "./format-html-scss.ts";
import {
  kBootstrapDependencyName,
  kDocumentCss,
  kFootnoteSectionTitle,
  kFootnotesMargin,
  kPageLayout,
  kPageLayoutArticle,
  kPageLayoutCustom,
  kPageLayoutNone,
} from "./format-html-shared.ts";

export function formatHasBootstrap(format: Format) {
  if (format && isHtmlOutput(format.pandoc, true)) {
    const theme = format.metadata[kTheme];
    return theme !== "none" && theme !== "pandoc";
  } else {
    return false;
  }
}

// Returns a boolean indicating whether dark mode is requested
// (true or false) or undefined if the dark mode support isn't present
// Key order determines whether dark mode is true or false
export function formatDarkMode(format: Format): boolean | undefined {
  const isBootstrap = formatHasBootstrap(format);
  if (isBootstrap) {
    return darkModeDefault(format.metadata);
  }
  return undefined;
}

function darkModeDefault(metadata?: Metadata): boolean | undefined {
  if (metadata !== undefined) {
    const theme = metadata[kTheme];
    if (theme && typeof (theme) === "object") {
      const keys = Object.keys(theme);
      if (keys.includes("dark")) {
        if (keys[0] === "dark") {
          return true;
        } else {
          return false;
        }
      }
    }
  }
  return undefined;
}

export function formatPageLayout(format: Format) {
  return format.metadata[kPageLayout] || kPageLayoutArticle;
}

export function formatHasPageLayout(format: Format) {
  return format.metadata[kPageLayout] === undefined ||
    format.metadata[kPageLayout] !== kPageLayoutNone;
}

export function formatHasArticlePageLayout(format: Format) {
  return format.metadata[kPageLayout] === undefined ||
    format.metadata[kPageLayout] === kPageLayoutArticle;
}

export function formatHasCustomPageLayout(format: Format) {
  return format.metadata[kPageLayout] == kPageLayoutCustom;
}

export function bootstrapFormatDependency() {
  const boostrapResource = (resource: string) =>
    formatResourcePath(
      "html",
      join("bootstrap", "dist", resource),
    );
  const bootstrapDependency = (resource: string) => ({
    name: resource,
    path: boostrapResource(resource),
  });

  return {
    name: kBootstrapDependencyName,
    stylesheets: [
      bootstrapDependency("bootstrap-icons.css"),
    ],
    scripts: [
      bootstrapDependency("bootstrap.min.js"),
    ],
    resources: [
      bootstrapDependency("bootstrap-icons.woff"),
    ],
  };
}

export function boostrapExtras(
  input: string,
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  const toc = hasTableOfContents(flags, format);

  const renderTemplate = (template: string, pageLayout: string) => {
    return renderEjs(formatResourcePath("html", `templates/${template}`), {
      toc,
      pageLayout,
    });
  };

  const bodyEnvelope = formatHasArticlePageLayout(format)
    ? {
      before: renderTemplate("before-body-article.ejs", kPageLayoutArticle),
      after: renderTemplate("after-body-article.ejs", kPageLayoutArticle),
    }
    : formatHasCustomPageLayout(format)
    ? {
      before: renderTemplate("before-body-custom.ejs", kPageLayoutCustom),
      after: renderTemplate("after-body-custom.ejs", kPageLayoutCustom),
    }
    : undefined;

  return {
    pandoc: {
      [kSectionDivs]: true,
      [kHtmlMathMethod]: "mathjax",
    },
    metadata: {
      [kDocumentCss]: false,
      [kLinkCitations]: true,
    },
    [kTocTitle]: !hasTableOfContentsTitle(flags, format)
      ? "Table of contents"
      : undefined,

    html: {
      [kSassBundles]: resolveBootstrapScss(input, format),
      [kDependencies]: [bootstrapFormatDependency()],
      [kBodyEnvelope]: bodyEnvelope,
      [kHtmlPostprocessors]: [
        bootstrapHtmlPostprocessor(format),
      ],
    },
  };
}

function bootstrapHtmlPostprocessor(format: Format) {
  return (doc: Document): Promise<string[]> => {
    // use display-7 style for title
    const title = doc.querySelector("header > .title");
    if (title) {
      title.classList.add("display-7");
    }

    // If margin footnotes are enabled move them
    if (format.metadata?.[kFootnotesMargin]) {
      // This is a little complicated because if there are multiple footnotes
      // in a single block, we want to wrap them in a container so they
      // all can appear adjacent to the block (otherwise only the first would appear)
      // next to the block, and subsequent ones would appear below the block

      // Find all the footnote links
      const footnoteEls = doc.querySelectorAll(".footnote-ref");

      let currentParent: Element | null = null;
      let pendingFootnotes: Element[] = [];

      const appendFootnotes = (parent: Element, footnotes: Element[]) => {
        if (footnotes.length === 1) {
          footnotes[0].classList.add("footnote-gutter");
          parent.appendChild(footnotes[0]);
        } else {
          const containerEl = doc.createElement("div");
          containerEl.classList.add("footnote-gutter");
          for (const footnote of footnotes) {
            containerEl.appendChild(footnote);
          }
          parent.appendChild(containerEl);
        }
      };

      footnoteEls.forEach((footnoteEl) => {
        const footNoteLink = footnoteEl as Element;
        if (footNoteLink.hasAttribute("href")) {
          const target = footNoteLink.getAttribute("href");
          if (target) {
            const footnoteContentsEl = doc.getElementById(target.slice(1));
            if (footnoteContentsEl) {
              if (
                currentParent !== null &&
                currentParent !== footnoteEl.parentElement
              ) {
                appendFootnotes(currentParent, pendingFootnotes);
                pendingFootnotes = [];
              }

              currentParent = footnoteEl.parentElement;

              // Create a new footnote div and move the contents into it
              const footnoteDiv = doc.createElement("div");
              footnoteDiv.id = footnoteContentsEl?.id;
              footnoteDiv.setAttribute(
                "role",
                footnoteContentsEl.getAttribute("role"),
              );
              Array.from(footnoteContentsEl.children).forEach((child) => {
                footnoteDiv.appendChild(child);
              });
              pendingFootnotes.push(footnoteDiv);

              // Remove the old footnote
              footnoteContentsEl.remove();
            }
          }
        }
      });

      if (currentParent && pendingFootnotes) {
        appendFootnotes(currentParent, pendingFootnotes);
      }
    }

    // Forward caption class from parents to the child fig caps
    const gutterCaptions = doc.querySelectorAll(".caption-gutter");
    gutterCaptions.forEach((captionContainerNode) => {
      const captionContainer = (captionContainerNode as Element);

      const moveClassToCaption = (container: Element, sel: string) => {
        const target = container.querySelector(sel);
        if (target) {
          target.classList.add("caption-gutter");
          return true;
        } else {
          return false;
        }
      };

      const removeCaptionClass = (el: Element) => {
        // Remove this since it will place the contents in the gutter if it remains present
        el.classList.remove("caption-gutter");
      };

      // Deal with layout panels (we will only handle the main caption not the internals)
      const isLayoutPanel = captionContainer.classList.contains(
        "quarto-layout-panel",
      );
      if (isLayoutPanel) {
        const figure = captionContainer.querySelector("figure");
        if (figure) {
          // It is a figure panel, find a direct child caption of the outer figure.
          for (const child of figure.children) {
            if (child.tagName === "FIGCAPTION") {
              child.classList.add("caption-gutter");
              removeCaptionClass(captionContainer);
              break;
            }
          }
        } else {
          // it is not a figure panel, find the panel caption
          const caption = captionContainer.querySelector(".panel-caption");
          if (caption) {
            caption.classList.add("caption-gutter");
            removeCaptionClass(captionContainer);
          }
        }
      } else {
        // First try finding a fig caption
        const foundCaption = moveClassToCaption(captionContainer, "figcaption");
        if (!foundCaption) {
          // find a table caption and copy the contents into a div with style figure-caption
          // note that for tables, our grid inception approach isn't going to work, so
          // we make a copy of the caption contents and place that in the same container as the
          // table and bind it to the grid
          const captionEl = captionContainer.querySelector("caption");
          if (captionEl) {
            const parentDivEl = captionEl?.parentElement?.parentElement;
            if (parentDivEl) {
              captionEl.classList.add("hidden");

              const divCopy = doc.createElement("div");
              divCopy.classList.add("figure-caption");
              divCopy.classList.add("caption-gutter");
              divCopy.innerHTML = captionEl.innerHTML;
              parentDivEl.appendChild(divCopy);
              removeCaptionClass(captionContainer);
            }
          }
        } else {
          removeCaptionClass(captionContainer);
        }
      }
    });

    // Find any elements that are using fancy layouts (columns)
    const columnLayouts = doc.querySelectorAll(
      '[class^="column-"], [class*=" column-"], aside, [class*="caption-gutter"], [class*=" caption-gutter"]',
    );
    // If there are any of these elements, we need to be sure that their
    // parents have acess to the grid system, so make the parent full screen width
    // and apply the grid system to it (now the child 'column-' element can be positioned
    // anywhere in the grid system)
    if (columnLayouts && columnLayouts.length > 0) {
      const ensureInGrid = (el: Element, setLayout: boolean) => {
        // Add the grid system. Children of the grid system
        // are placed into the body-content column by default
        // (CSS implements this)
        if (!el.classList.contains("page-columns")) {
          el.classList.add("page-columns");
        }

        // Mark full width
        if (setLayout && !el.classList.contains("page-full")) {
          el.classList.add("page-full");
        }

        // Process parents up to the main tag
        if (el.tagName !== "MAIN") {
          const parent = el.parentElement;
          if (parent) {
            ensureInGrid(parent, true);
          }
        }
      };

      columnLayouts.forEach((node) => {
        const el = node as Element;
        if (el.parentElement) {
          ensureInGrid(el.parentElement, true);
        }
      });
    }

    // add 'lead' to subtitle
    const subtitle = doc.querySelector("header > .subtitle");
    if (subtitle) {
      subtitle.classList.add("lead");
    }

    // add 'blockquote' class to blockquotes
    const blockquotes = doc.querySelectorAll("blockquote");
    for (let i = 0; i < blockquotes.length; i++) {
      const classList = (blockquotes[i] as Element).classList;
      classList.add("blockquote");
    }

    // add figure classes to figures
    const figures = doc.querySelectorAll("figure");
    for (let i = 0; i < figures.length; i++) {
      const figure = (figures[i] as Element);
      figure.classList.add("figure");
      const images = figure.querySelectorAll("img");
      for (let j = 0; j < images.length; j++) {
        (images[j] as Element).classList.add("figure-img");
      }
      const captions = figure.querySelectorAll("figcaption");
      for (let j = 0; j < captions.length; j++) {
        (captions[j] as Element).classList.add("figure-caption");
      }
    }

    // move the toc if there is a sidebar
    const toc = doc.querySelector('nav[role="doc-toc"]');
    const tocSidebar = doc.getElementById("quarto-toc-sidebar");
    if (toc && tocSidebar) {
      // add nav-link class to the TOC links
      const tocLinks = doc.querySelectorAll('nav[role="doc-toc"] > ul a');
      for (let i = 0; i < tocLinks.length; i++) {
        // Mark the toc links as nav-links
        const tocLink = tocLinks[i] as Element;
        tocLink.classList.add("nav-link");
        if (i === 0) {
          tocLink.classList.add("active");
        }

        // move the raw href to the target attribute (need the raw value, not the full path)
        if (!tocLink.hasAttribute("data-scroll-target")) {
          tocLink.setAttribute(
            "data-scroll-target",
            tocLink.getAttribute("href")?.replaceAll(":", "\\:"),
          );
        }
      }

      // default collapse non-top level TOC nodes
      const nestedUls = toc.querySelectorAll("ul ul");
      for (let i = 0; i < nestedUls.length; i++) {
        const ul = nestedUls[i] as Element;
        ul.classList.add("collapse");
      }

      // Copy the classes over
      tocSidebar.classList.forEach((className) => {
        toc.classList.add(className);
      });
      // Replace the toc placeholder and move any classes
      toc.remove();
      tocSidebar.replaceWith(toc);
    }

    // add .table class to pandoc tables
    const tableHeaders = doc.querySelectorAll("tbody > tr:first-child.odd");
    for (let i = 0; i < tableHeaders.length; i++) {
      const th = tableHeaders[i];
      if (th.parentNode?.parentNode) {
        const table = th.parentNode.parentNode as Element;
        table.removeAttribute("style");
        table.classList.add("table");
      }
    }

    // add .table class to pandas tables
    const pandasTables = doc.querySelectorAll("table.dataframe");
    for (let i = 0; i < pandasTables.length; i++) {
      const table = pandasTables[i] as Element;
      table.removeAttribute("border");
      table.classList.add("table");
      const headerRows = table.querySelectorAll("tr");
      for (let r = 0; r < headerRows.length; r++) {
        (headerRows[r] as Element).removeAttribute("style");
      }
      if (
        table.previousElementSibling &&
        table.previousElementSibling.tagName === "STYLE"
      ) {
        table.previousElementSibling.remove();
      }
    }

    // provide data-anchor-id to headings
    const sections = doc.querySelectorAll('section[class^="level"]');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as Element;
      const heading = section.querySelector("h2") ||
        section.querySelector("h3") || section.querySelector("h4") ||
        section.querySelector("h5") || section.querySelector("h6");
      if (heading) {
        heading.setAttribute("data-anchor-id", section.id);
      }
    }


    // provide heading for footnotes (but only if there is one section, there could
    // be multiple if they used reference-location: block/section)
    const footnotes = doc.querySelectorAll('section[role="doc-endnotes"]');
    if (footnotes.length === 1 && !format.metadata?.[kFootnotesMargin]) {
      const footnotesEl = footnotes.item(0) as Element;
      const h2 = doc.createElement("h2");
      const title =
        (format.metadata[kFootnoteSectionTitle] || "Footnotes") as string;
      if (typeof (title) == "string" && title !== "none") {
        h2.innerHTML = title;
      }
      footnotesEl.insertBefore(h2, footnotesEl.firstChild);
      const hr = footnotesEl.querySelector("hr");
      if (hr) {
        hr.remove();
      }
    }

    // no resource refs
    return Promise.resolve([]);
  };
}
