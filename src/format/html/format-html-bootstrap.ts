/*
* format-html-bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";
import { join } from "path/mod.ts";

import { renderEjs } from "../../core/ejs.ts";
import { formatResourcePath } from "../../core/resources.ts";

import {
  kHtmlMathMethod,
  kLinkCitations,
  kSectionDivs,
  kTocTitle,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  isHtmlOutput,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
} from "../../config/format.ts";
import { PandocFlags } from "../../config/flags.ts";
import {
  hasTableOfContents,
  hasTableOfContentsTitle,
} from "../../config/toc.ts";

import { resolveBootstrapScss } from "./format-html-scss.ts";
import {
  kBootstrapDependencyName,
  kDocumentCss,
  kFootnoteSectionTitle,
  kPageLayout,
} from "./format-html.ts";

export function formatHasBootstrap(format: Format) {
  if (format && isHtmlOutput(format.pandoc, true)) {
    const theme = format.metadata["theme"];
    return theme !== "none" && theme !== "pandoc";
  } else {
    return false;
  }
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
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  const toc = hasTableOfContents(flags, format);

  const renderTemplate = (template: string) => {
    return renderEjs(formatResourcePath("html", `templates/${template}`), {
      toc,
    });
  };

  const bodyEnvelope = format.metadata[kPageLayout] !== "none"
    ? {
      before: renderTemplate("before-body.ejs"),
      after: renderTemplate("after-body.ejs"),
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
      [kSassBundles]: [resolveBootstrapScss(format.metadata)],
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
    // use display-6 style for title
    const title = doc.querySelector("header > .title");
    if (title) {
      title.classList.add("display-6");
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
      tocSidebar.appendChild(toc);
      // add scroll spy to the body
      const body = doc.body;
      body.setAttribute("data-bs-spy", "scroll");
      body.setAttribute("data-bs-target", "#" + tocSidebar.id);

      // add nav-link class to the TOC links
      const tocLinks = doc.querySelectorAll('nav[role="doc-toc"] > ul a');
      for (let i = 0; i < tocLinks.length; i++) {
        // Mark the toc links as nav-links
        const tocLink = tocLinks[i] as Element;
        tocLink.classList.add("nav-link");

        // move the raw href to the target attribute (need the raw value, not the full path)
        if (!tocLink.hasAttribute("data-bs-target")) {
          tocLink.setAttribute(
            "data-bs-target",
            tocLink.getAttribute("href")?.replaceAll(":", "\\:"),
          );
        }
      }
    }

    // add .table class to pandoc tables
    const tableHeaders = doc.querySelectorAll("tr.header");
    for (let i = 0; i < tableHeaders.length; i++) {
      const th = tableHeaders[i];
      if (th.parentNode?.parentNode) {
        (th.parentNode.parentNode as Element).classList.add("table");
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

    // move ids from section to headers
    const sections = doc.querySelectorAll('section[class^="level"]');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as Element;
      const heading = section.querySelector("h2") ||
        section.querySelector("h3") || section.querySelector("h4") ||
        section.querySelector("h5") || section.querySelector("h6");
      if (heading) {
        heading.setAttribute("id", section.id);
        section.removeAttribute("id");
      }
    }

    // provide heading for footnotes
    const footnotes = doc.querySelector('section[role="doc-endnotes"]');
    if (footnotes) {
      const h2 = doc.createElement("h2");
      const title =
        (format.metadata[kFootnoteSectionTitle] || "Footnotes") as string;
      if (typeof (title) == "string" && title !== "none") {
        h2.innerHTML = title;
      }
      footnotes.insertBefore(h2, footnotes.firstChild);
      const hr = footnotes.querySelector("hr");
      if (hr) {
        hr.remove();
      }
    }

    // no resource refs
    return Promise.resolve([]);
  };
}
