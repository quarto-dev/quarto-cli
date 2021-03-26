/*
* format-html-bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { renderEjs } from "../../core/ejs.ts";
import { formatResourcePath } from "../../core/resources.ts";

import {
  kFilters,
  kHtmlMathMethod,
  kLinkCitations,
  kSectionDivs,
  kTocTitle,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
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
  kCodeCopy,
  kDocumentCss,
  kFootnoteSectionTitle,
  kPageLayout,
} from "./format-html.ts";

export function formatHasBootstrap(format: Format) {
  if (format) {
    const theme = format.metadata["theme"];
    return theme !== "none" && theme !== "pandoc";
  } else {
    return false;
  }
}

export function bootstrapFormatDependency(format: Format) {
  const boostrapResource = (resource: string) =>
    formatResourcePath(
      "html",
      `bootstrap/themes/default/${resource}`,
    );
  const bootstrapDependency = (resource: string) => ({
    name: resource,
    path: boostrapResource(resource),
  });

  return {
    name: kBootstrapDependencyName,
    version: "v5.0.0-beta2",
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

    [kFilters]: {
      pre: [
        formatResourcePath("html", "html.lua"),
      ],
    },

    html: {
      [kSassBundles]: [resolveBootstrapScss(format.metadata)],
      [kDependencies]: [bootstrapFormatDependency(format)],
      [kBodyEnvelope]: bodyEnvelope,
      [kHtmlPostprocessors]: [bootstrapHtmlPostprocessor(format)],
    },
  };
}

function bootstrapHtmlPostprocessor(format: Format) {
  // read options
  const codeCopy = format.metadata[kCodeCopy] !== false;

  return (doc: Document): string[] => {
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
      const tocLinks = doc.querySelectorAll('nav[role="doc-toc"] a');
      for (let i = 0; i < tocLinks.length; i++) {
        // Mark the toc links as nav-links
        const tocLink = tocLinks[i] as Element;
        tocLink.classList.add("nav-link");

        // move the raw href to the target attribute (need the raw value, not the full path)
        if (!tocLink.hasAttribute("data-bs-target")) {
          tocLink.setAttribute("data-bs-target", tocLink.getAttribute("href"));
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

    // insert code copy button
    if (codeCopy) {
      const codeBlocks = doc.querySelectorAll("pre.sourceCode");
      for (let i = 0; i < codeBlocks.length; i++) {
        const code = codeBlocks[i];

        const copyButton = doc.createElement("button");
        const title = "Copy to Clipboard";
        copyButton.setAttribute("title", title);
        copyButton.classList
          .add("code-copy-button");
        const copyIcon = doc.createElement("i");
        copyIcon.classList.add("bi");
        copyButton.appendChild(copyIcon);

        code.appendChild(copyButton);
      }
    }

    // no resource refs
    return [];
  };
}
