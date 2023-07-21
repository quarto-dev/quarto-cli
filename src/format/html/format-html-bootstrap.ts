/*
 * format-html-bootstrap.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { dirname, isAbsolute, join, relative } from "path/mod.ts";

import { renderEjs } from "../../core/ejs.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { findParent } from "../../core/html.ts";

import {
  kContentMode,
  kDisableArticleLayout,
  kDisplayName,
  kExtensionName,
  kFormatLinks,
  kGrid,
  kHtmlMathMethod,
  kIncludeInHeader,
  kLinkCitations,
  kNotebookLinks,
  kOtherLinks,
  kOtherLinksTitle,
  kQuartoTemplateParams,
  kRelatedFormatsTitle,
  kSectionDivs,
  kTargetFormat,
  kTocDepth,
  kTocExpand,
  kTocLocation,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  FormatLink,
  kBodyEnvelope,
  kDependencies,
  kHtmlFinalizers,
  kHtmlPostprocessors,
  kSassBundles,
  Metadata,
  OtherLink,
  SassLayer,
} from "../../config/types.ts";
import { PandocFlags } from "../../config/types.ts";
import { hasTableOfContents } from "../../config/toc.ts";

import { resolveBootstrapScss } from "./format-html-scss.ts";
import {
  formatHasArticleLayout,
  formatHasFullLayout,
  formatPageLayout,
  hasMarginCites,
  hasMarginRefs,
  kAppendixStyle,
  kBootstrapDependencyName,
  kDocumentCss,
  kPageLayout,
  kPageLayoutCustom,
  setMainColumn,
} from "./format-html-shared.ts";
import {
  HtmlPostProcessor,
  HtmlPostProcessResult,
  PandocInputTraits,
  RenderedFormat,
  RenderServices,
} from "../../command/render/types.ts";
import { processDocumentAppendix } from "./format-html-appendix.ts";
import {
  documentTitleIncludeInHeader,
  documentTitleMetadata,
  documentTitlePartial,
  documentTitleScssLayer,
  processDocumentTitle,
} from "./format-html-title.ts";
import { kTemplatePartials } from "../../command/render/template.ts";
import {
  isDocxOutput,
  isHtmlOutput,
  isIpynbOutput,
  isJatsOutput,
  isMarkdownOutput,
  isPdfOutput,
  isPresentationOutput,
} from "../../config/format.ts";
import { basename } from "path/mod.ts";
import { emplaceNotebookPreviews } from "./format-html-notebook.ts";
import { ProjectContext } from "../../project/types.ts";
import { extname } from "path/mod.ts";
import { AlternateLink, otherFormatLinks } from "./format-html-links.ts";

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
  services: RenderServices,
  offset?: string,
  project?: ProjectContext,
  quiet?: boolean,
): FormatExtras {
  const toc = hasTableOfContents(flags, format);
  const tocLocation = toc
    ? format.metadata[kTocLocation] || "right"
    : undefined;

  const renderTemplate = (template: string, pageLayout: string) => {
    return renderEjs(formatResourcePath("html", `templates/${template}`), {
      toc,
      tocLocation,
      pageLayout,
    });
  };

  const pageLayout = formatPageLayout(format);
  const bodyEnvelope = formatHasArticleLayout(format)
    ? {
      before: renderTemplate("before-body-article.ejs", pageLayout),
      afterPreamble: renderTemplate(
        "after-body-article-preamble.ejs",
        pageLayout,
      ),
      afterPostamble: renderTemplate(
        "after-body-article-postamble.ejs",
        pageLayout,
      ),
    }
    : {
      before: renderTemplate("before-body-custom.ejs", kPageLayoutCustom),
      afterPreamble: renderTemplate(
        "after-body-custom-preamble.ejs",
        kPageLayoutCustom,
      ),
      afterPostamble: renderTemplate(
        "after-body-custom-postamble.ejs",
        kPageLayoutCustom,
      ),
    };

  // Gather the title data for this page
  const { partials, templateParams } = documentTitlePartial(
    format,
  );
  const sassLayers: SassLayer[] = [];
  const titleSassLayer = documentTitleScssLayer(format);
  if (titleSassLayer) {
    sassLayers.push(titleSassLayer);
  }
  const includeInHeader: string[] = [];
  const titleInclude = documentTitleIncludeInHeader(
    input,
    format,
    services.temp,
  );
  if (titleInclude) {
    includeInHeader.push(titleInclude);
  }

  const titleMetadata = documentTitleMetadata(format);

  const scssBundles = resolveBootstrapScss(input, format, sassLayers);

  return {
    pandoc: {
      [kSectionDivs]: true,
      [kHtmlMathMethod]: "mathjax",
    },
    metadata: {
      [kDocumentCss]: false,
      [kLinkCitations]: true,
      [kTemplatePartials]: partials,
      [kQuartoTemplateParams]: templateParams,
      ...titleMetadata,
    },
    [kIncludeInHeader]: includeInHeader,
    html: {
      [kSassBundles]: scssBundles,
      [kDependencies]: [bootstrapFormatDependency()],
      [kBodyEnvelope]: bodyEnvelope,
      [kHtmlPostprocessors]: [
        bootstrapHtmlPostprocessor(
          input,
          format,
          flags,
          services,
          offset,
          project,
          quiet,
        ),
      ],
      [kHtmlFinalizers]: [
        bootstrapHtmlFinalizer(format, flags),
      ],
    },
  };
}

// Find any elements that are using fancy layouts (columns)
const getColumnLayoutElements = (doc: Document) => {
  return doc.querySelectorAll(
    '[class^="column-"], [class*=" column-"], aside:not(.footnotes), [class*="margin-caption"], [class*=" margin-caption"], [class*="margin-ref"], [class*=" margin-ref"]',
  );
};

function bootstrapHtmlPostprocessor(
  input: string,
  format: Format,
  flags: PandocFlags,
  services: RenderServices,
  offset?: string,
  project?: ProjectContext,
  quiet?: boolean,
): HtmlPostProcessor {
  return async (
    doc: Document,
    options: {
      inputMetadata: Metadata;
      inputTraits: PandocInputTraits;
      renderedFormats: RenderedFormat[];
      quiet?: boolean;
    },
  ): Promise<HtmlPostProcessResult> => {
    // Resources used in this post processor
    const resources: string[] = [];
    const supporting: string[] = [];

    // use display-7 style for title
    const title = doc.querySelector("header > .title");
    if (title) {
      title.classList.add("display-7");
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
      const figure = figures[i] as Element;
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

    const tocTarget = doc.getElementById("quarto-toc-target");

    const useDoubleToc =
      (format.metadata[kTocLocation] as string)?.includes("-body") ?? false;

    if (toc && tocTarget) {
      if (useDoubleToc) {
        // Clone the TOC
        // Leave it where it is in the document, and just mutate it
        const clonedToc = toc.cloneNode(true) as Element;
        clonedToc.id = "TOC-body";
        const tocActionsEl = clonedToc.querySelector(".toc-actions");
        if (tocActionsEl) {
          tocActionsEl.remove();
        }

        toc.parentElement?.insertBefore(clonedToc, toc);
      }

      // activate selection behavior for this
      toc.classList.add("toc-active");

      const expanded = format.metadata[kTocExpand];
      if (expanded !== undefined) {
        if (expanded === true) {
          toc.setAttribute("data-toc-expanded", 99);
        } else if (expanded) {
          toc.setAttribute("data-toc-expanded", expanded);
        } else {
          toc.setAttribute("data-toc-expanded", -1);
        }
      }
      // add nav-link class to the TOC links
      const tocLinks = doc.querySelectorAll('nav#TOC[role="doc-toc"] > ul a');

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
      const tocDepth = format.pandoc[kTocDepth] || 3;
      if (tocDepth > 1) {
        const ulSelector = "ul ".repeat(tocDepth - 1).trim();

        const nestedUls = toc.querySelectorAll(ulSelector);
        for (let i = 0; i < nestedUls.length; i++) {
          const ul = nestedUls[i] as Element;
          ul.classList.add("collapse");
        }
      }

      toc.remove();
      tocTarget.replaceWith(toc);
    } else {
      tocTarget?.remove();
    }

    // Inject links to other formats if there is another
    // format that of this file that has been rendered
    if (format.render[kFormatLinks] !== false) {
      processAlternateFormatLinks(input, options, doc, format, resources);
    }

    // Look for included / embedded notebooks and include those
    if (format.render[kNotebookLinks] !== false) {
      const renderedHtml = options.renderedFormats.find((renderedFormat) => {
        return isHtmlOutput(renderedFormat.format.pandoc, true);
      });
      const notebookResults = await emplaceNotebookPreviews(
        input,
        doc,
        format,
        services,
        project,
        renderedHtml?.path,
        quiet,
      );
      if (notebookResults) {
        resources.push(...notebookResults.resources);
        supporting.push(...notebookResults.supporting);
      }
    }

    if (format.metadata[kOtherLinks]) {
      processOtherLinks(doc, format);
    }

    // default treatment for computational tables
    const addTableClasses = (table: Element, computational = false) => {
      table.classList.add("table");
      if (computational) {
        table.classList.add("table-sm");
        table.classList.add("table-striped");
        table.classList.add("small");
      }
    };

    // add .table class to pandoc tables
    const tableHeaders = doc.querySelectorAll("tbody > tr:first-child.odd");
    for (let i = 0; i < tableHeaders.length; i++) {
      const th = tableHeaders[i];
      if (th.parentNode?.parentNode) {
        const table = th.parentNode.parentNode as Element;
        table.removeAttribute("style");
        addTableClasses(
          table,
          !!findParent(table, (el) => el.classList.contains("cell")),
        );
      }
    }

    // add .table class to pandas tables
    const pandasTables = doc.querySelectorAll("table.dataframe");
    for (let i = 0; i < pandasTables.length; i++) {
      const table = pandasTables[i] as Element;
      table.removeAttribute("border");
      addTableClasses(table, true);
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

    // add .table class to DataFrames.jl tables
    const dataFramesTables = doc.querySelectorAll("table.data-frame");
    for (let i = 0; i < dataFramesTables.length; i++) {
      const table = dataFramesTables[i] as Element;
      addTableClasses(table, true);
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

    // Process the title elements of this document
    const titleResourceFiles = processDocumentTitle(
      input,
      format,
      flags,
      doc,
    );
    resources.push(...titleResourceFiles);

    // Process the elements of this document into an appendix
    if (
      format.metadata[kAppendixStyle] !== false &&
      format.metadata[kAppendixStyle] !== "none"
    ) {
      await processDocumentAppendix(
        input,
        options.inputTraits,
        format,
        flags,
        doc,
        offset,
      );
    }
    // no resource refs
    return Promise.resolve({ resources, supporting });
  };
}

function createLinkChild(formatLink: AlternateLink, doc: Document) {
  const link = doc.createElement("a");
  link.setAttribute("href", formatLink.href);
  if (formatLink.attr) {
    for (const key of Object.keys(formatLink.attr)) {
      const value = formatLink.attr[key];
      link.setAttribute(key, value);
    }
  }

  if (formatLink.dlAttrValue) {
    link.setAttribute("download", formatLink.dlAttrValue);
  }

  const icon = doc.createElement("i");
  icon.classList.add("bi");
  icon.classList.add(`bi-${formatLink.icon}`);
  link.appendChild(icon);
  link.appendChild(doc.createTextNode(formatLink.title));

  return link;
}

function processOtherLinks(
  doc: Document,
  format: Format,
) {
  const otherLinks = format.metadata[kOtherLinks] as FormatLink[];
  const dlLinkTarget = getLinkTarget(doc, "quarto-other-links-target");
  if (otherLinks && otherLinks.length > 0 && dlLinkTarget) {
    const containerEl = doc.createElement("div");
    containerEl.classList.add("quarto-other-links");

    const heading = dlLinkTarget.makeHeadingEl();
    if (format.language[kOtherLinksTitle]) {
      heading.innerText = format.language[kOtherLinksTitle];
    }
    containerEl.appendChild(heading);

    const getAttrs = (otherLink: OtherLink) => {
      if (otherLink.rel || otherLink.target) {
        const attrs: Record<string, string> = {};
        if (otherLink.rel) {
          attrs.rel = otherLink.rel;
        }
        if (otherLink.target) {
          attrs.target = otherLink.target;
        }
        return attrs;
      } else {
        return undefined;
      }
    };

    const linkList = dlLinkTarget.makeContainerEl();
    let order = 0;
    for (const otherLink of otherLinks) {
      const alternateLink: AlternateLink = {
        icon: otherLink.icon || "link-45deg",
        href: otherLink.href,
        title: otherLink.text,
        order: ++order,
        attr: getAttrs(otherLink),
      };
      const li = dlLinkTarget.makeItemEl();
      li.appendChild(createLinkChild(alternateLink, doc));
      if (linkList) {
        linkList.appendChild(li);
      } else {
        containerEl.appendChild(li);
      }
    }
    if (linkList) {
      containerEl.appendChild(linkList);
    }

    dlLinkTarget.targetEl.appendChild(containerEl);
  }
}

function getLinkTarget(doc: Document, explicitTargetClz: string) {
  // Look for an explicit target
  const explicitTarget = doc.querySelector(`.${explicitTargetClz}`);
  if (explicitTarget !== null) {
    return {
      targetEl: explicitTarget,
      makeHeadingEl: () => {
        const headingEl = doc.createElement("div");
        headingEl.classList.add("quarto-title-meta-heading");
        return headingEl;
      },
      makeContainerEl: () => {
        return undefined;
      },
      makeItemEl: () => {
        const itemEl = doc.createElement("div");
        itemEl.classList.add("quarto-title-meta-contents");
        return itemEl;
      },
    };
  }

  // Now search for a place to put the links
  let dlLinkTarget = doc.querySelector(`nav[role="doc-toc"]`);
  if (dlLinkTarget === null) {
    dlLinkTarget = doc.getElementById(kMarginSidebarId);
  }
  if (dlLinkTarget !== null) {
    return {
      targetEl: dlLinkTarget,
      makeHeadingEl: () => {
        return doc.createElement("h2");
      },
      makeContainerEl: () => {
        return doc.createElement("ul");
      },
      makeItemEl: () => {
        return doc.createElement("li");
      },
    };
  }
}

function processAlternateFormatLinks(
  input: string,
  options: {
    inputMetadata: Metadata;
    inputTraits: PandocInputTraits;
    renderedFormats: RenderedFormat[];
  },
  doc: Document,
  format: Format,
  resources: string[],
) {
  if (options.renderedFormats.length > 1) {
    const dlLinkTarget = getLinkTarget(doc, "quarto-other-formats-target");
    if (dlLinkTarget) {
      const containerEl = doc.createElement("div");
      containerEl.classList.add("quarto-alternate-formats");

      const heading = dlLinkTarget.makeHeadingEl();
      if (format.language[kRelatedFormatsTitle]) {
        heading.innerText = format.language[kRelatedFormatsTitle];
      }
      containerEl.appendChild(heading);

      const otherLinks = otherFormatLinks(
        input,
        format,
        options.renderedFormats,
      );

      const formatList = dlLinkTarget.makeContainerEl();
      for (
        const alternateLink of otherLinks.sort(({ order: a }, { order: b }) =>
          a - b
        )
      ) {
        const li = dlLinkTarget.makeItemEl();

        const link = doc.createElement("a");
        link.setAttribute("href", alternateLink.href);
        if (alternateLink.dlAttrValue) {
          link.setAttribute("download", alternateLink.dlAttrValue);
        }
        if (alternateLink.attr) {
          for (const key of Object.keys(alternateLink.attr)) {
            const value = alternateLink.attr[key];
            link.setAttribute(key, value);
          }
        }

        const icon = doc.createElement("i");
        icon.classList.add("bi");
        icon.classList.add(`bi-${alternateLink.icon}`);
        link.appendChild(icon);
        link.appendChild(doc.createTextNode(alternateLink.title));

        li.appendChild(link);
        if (formatList) {
          formatList.appendChild(li);
        } else {
          containerEl.appendChild(li);
        }

        resources.push(alternateLink.href);
      }

      if (otherLinks.length > 0) {
        if (formatList) {
          containerEl.appendChild(formatList);
        }
        dlLinkTarget.targetEl.appendChild(containerEl);
      }
    }
  }
}

function bootstrapHtmlFinalizer(format: Format, flags: PandocFlags) {
  return (doc: Document): Promise<void> => {
    const { citesInMargin, refsInMargin } = processColumnElements(
      doc,
      format,
      flags,
    );

    if (format.metadata[kDisableArticleLayout]) {
      const stripColumnClasses = (el: Element) => {
        const stripClz: string[] = [];
        el.classList.forEach((clz) => {
          if (
            clz === "margin-caption" || clz === "margin-ref" ||
            clz.startsWith("column-") || clz === "page-columns" ||
            clz === "page-full"
          ) {
            stripClz.push(clz);
          }
        });
        el.classList.remove(...stripClz);
        for (const childEl of el.children) {
          stripColumnClasses(childEl);
        }
      };

      const mainEl = doc.body.querySelector("main");
      if (mainEl) {
        stripColumnClasses(mainEl);
      }
    }

    // provide heading for footnotes (but only if there is one section, there could
    // be multiple if they used reference-location: block/section)
    if (refsInMargin) {
      const footNoteSectionEl = doc.querySelector("section.footnotes");
      if (footNoteSectionEl) {
        footNoteSectionEl.remove();
      }
    }

    // Purge the bibliography if we're using refs in margin
    if (citesInMargin) {
      const bibliographyDiv = doc.querySelector("div#refs");
      if (bibliographyDiv) {
        bibliographyDiv.remove();
      }
    }

    const fullLayout = formatHasFullLayout(format);
    if (fullLayout) {
      // If we're in a full layout, get rid of empty sidebar elements
      const leftSidebar = hasContents(kSidebarId, doc);
      if (!leftSidebar) {
        const sidebarEl = doc.getElementById(kSidebarId);
        sidebarEl?.remove();
      }

      const column = suggestColumn(doc);
      setMainColumn(doc, column);
    }

    // Note whether we need a narrow or wide margin layout
    const hasToc = !!format.pandoc.toc;
    const leftSidebar = doc.getElementById("quarto-sidebar");
    const hasLeftContent = leftSidebar && leftSidebar.children.length > 0;
    const rightSidebar = doc.getElementById("quarto-margin-sidebar");
    const hasRightContent = rightSidebar && rightSidebar.children.length > 0;
    const hasMarginContent =
      doc.querySelectorAll(".column-margin").length > 0 ||
      doc.querySelectorAll(".margin-caption").length > 0 ||
      doc.querySelectorAll(".margin-ref").length > 0;

    if (rightSidebar && !hasRightContent && !hasMarginContent && !hasToc) {
      rightSidebar.remove();
    }

    // Set the content mode for the grid system
    const gridObj = format.metadata[kGrid] as Metadata;
    let contentMode = "auto";
    if (gridObj) {
      contentMode =
        gridObj[kContentMode] as ("auto" | "standard" | "full" | "slim");
    }

    if (contentMode === undefined || contentMode === "auto") {
      const hasColumnElements = getColumnLayoutElements(doc).length > 0;
      if (hasColumnElements) {
        if (hasLeftContent && hasMarginContent) {
          // Slim down the content area so there are sizable margins
          // for the column element
          doc.body.classList.add("slimcontent");
        } else if (
          hasRightContent || hasMarginContent || fullLayout || hasToc
        ) {
          // Use the default layout, so don't add any classes
        } else {
          doc.body.classList.add("fullcontent");
        }
      } else {
        if (!hasRightContent && !hasMarginContent && !hasToc) {
          doc.body.classList.add("fullcontent");
        } else {
          // Use the deafult layout, don't add any classes
        }
      }
    } else {
      if (contentMode === "slim") {
        doc.body.classList.add("slimcontent");
      } else if (contentMode === "full") {
        doc.body.classList.add("fullcontent");
      }
    }

    // If there is no margin content and no toc in the right margin
    // then lower the z-order so everything else can get on top
    // of the sidebar
    const isFullLayout = format.metadata[kPageLayout] === "full";
    if (!hasMarginContent && isFullLayout && !hasRightContent) {
      const marginSidebarEl = doc.getElementById("quarto-margin-sidebar");
      marginSidebarEl?.classList.add("zindex-bottom");
    }
    return Promise.resolve();
  };
}

function processColumnElements(
  doc: Document,
  format: Format,
  flags: PandocFlags,
) {
  // Margin and column elements are only functional in article based layouts
  if (!formatHasArticleLayout(format)) {
    return {
      citesInMargin: false,
      refsInMargin: false,
    };
  }

  // Process captions that may appear in the margin
  processMarginCaptions(doc);

  // Process margin elements that may appear in callouts
  processMarginElsInCallouts(doc);

  // Process margin elements that may appear in tabsets
  processMarginElsInTabsets(doc);

  // Process non-margin figures - forward the column class
  // down into the figure so that the caption remains in the document
  // flow and the figure itself takes the column sizing
  processFigureOutputs(doc);

  // Group margin elements by their parents and wrap them in a container
  // Be sure to ignore containers which are already processed
  // and should be left alone
  const marginProcessors: MarginNodeProcessor[] = [
    simpleMarginProcessor,
  ];
  // If margin footnotes are enabled move them
  const refsInMargin = hasMarginRefs(format, flags);
  if (refsInMargin) {
    marginProcessors.unshift(footnoteMarginProcessor);
  }

  // If margin cites are enabled, move them
  const citesInMargin = hasMarginCites(format);
  if (citesInMargin) {
    marginProcessors.push(referenceMarginProcessor);
  }
  processMarginNodes(doc, marginProcessors);

  // If margin footnotes are enabled, remove any containers provided
  if (refsInMargin) {
    const footnoteContainer = doc.getElementById("footnotes");
    // Since it has margin footnotes, remove the end notes section
    if (footnoteContainer) {
      footnoteContainer.remove();
    }
  }

  const columnLayouts = getColumnLayoutElements(doc);

  // If there are any of these elements, we need to be sure that their
  // parents have acess to the grid system, so make the parent full screen width
  // and apply the grid system to it (now the child 'column-' element can be positioned
  // anywhere in the grid system)
  if (columnLayouts && columnLayouts.length > 0) {
    const processEl = (el: Element) => {
      if (el.tagName === "DIV" && el.id === "quarto-content") {
        return false;
      } else if (el.tagName === "BODY") {
        return false;
      } else {
        return true;
      }
    };

    const ensureInGrid = (el: Element, setLayout: boolean) => {
      if (processEl(el)) {
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

  return {
    citesInMargin,
    refsInMargin,
  };
}

const processMarginNodes = (
  doc: Document,
  processors: MarginNodeProcessor[],
) => {
  const marginSelector = processors.map((proc) => proc.selector).join(
    ", ",
  );
  const marginNodes = doc.querySelectorAll(marginSelector);
  marginNodes.forEach((marginNode) => {
    const marginEl = marginNode as Element;
    for (const processor of processors) {
      if (processor.canProcess(marginEl)) {
        processor.process(marginEl, doc);
        break;
      }
    }
    marginEl.classList.remove("column-margin");
  });
};

const findQuartoFigure = (el: Element): Element | undefined => {
  if (
    el.classList.contains("quarto-figure") ||
    el.classList.contains("quarto-layout-panel")
  ) {
    return el;
  } else if (el.parentElement) {
    return findQuartoFigure(el.parentElement);
  } else {
    return undefined;
  }
};

const moveClassToCaption = (container: Element, sel: string) => {
  const target = container.querySelector(sel);
  if (target) {
    target.classList.add("margin-caption");
    return true;
  } else {
    return false;
  }
};

const removeCaptionClass = (el: Element) => {
  // Remove this since it will place the contents in the margin if it remains present
  el.classList.remove("margin-caption");
};

const processLayoutPanelMarginCaption = (captionContainer: Element) => {
  const figure = captionContainer.querySelector("figure");
  if (figure) {
    // It is a figure panel, find a direct child caption of the outer figure.
    for (const child of figure.children) {
      if (child.tagName === "FIGCAPTION") {
        child.classList.add("margin-caption");
        removeCaptionClass(captionContainer);
        break;
      }
    }
  } else {
    // it is not a figure panel, find the panel caption
    const caption = captionContainer.querySelector(".panel-caption");
    if (caption) {
      caption.classList.add("margin-caption");
      removeCaptionClass(captionContainer);
    }
  }
};

const processFigureMarginCaption = (
  captionContainer: Element,
  doc: Document,
) => {
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
        divCopy.classList.add("margin-caption");
        divCopy.innerHTML = captionEl.innerHTML;
        parentDivEl.appendChild(divCopy);
        removeCaptionClass(captionContainer);
      }
    }
  } else {
    removeCaptionClass(captionContainer);
  }
};

const processTableMarginCaption = (
  captionContainer: Element,
  doc: Document,
) => {
  // Find a caption
  const caption = captionContainer.querySelector("caption");
  if (caption) {
    const marginCapEl = doc.createElement("DIV");
    marginCapEl.classList.add("quarto-table-caption");
    marginCapEl.classList.add("margin-caption");
    marginCapEl.innerHTML = caption.innerHTML;

    captionContainer.parentElement?.insertBefore(
      marginCapEl,
      captionContainer.nextElementSibling,
    );

    caption.remove();
    removeCaptionClass(captionContainer);
  }
};

// Process any captions that appear in margins
const processMarginCaptions = (doc: Document) => {
  // Identify elements that already appear in the margin
  // and in this case, remove the margin-caption class
  // since we do not want to further process the caption into the margin
  const captionsAlreadyInMargin = doc.querySelectorAll(
    ".column-margin .margin-caption",
  );
  captionsAlreadyInMargin.forEach((node) => {
    const el = node as Element;
    el.classList.remove("margin-caption");
  });

  // Forward caption class from parents to the child fig caps
  const marginCaptions = doc.querySelectorAll(".margin-caption");
  marginCaptions.forEach((node) => {
    const figureEl = node as Element;
    const captionContainer = findQuartoFigure(figureEl);
    if (captionContainer) {
      // Deal with layout panels (we will only handle the main caption not the internals)
      const isLayoutPanel = captionContainer.classList.contains(
        "quarto-layout-panel",
      );
      if (isLayoutPanel) {
        processLayoutPanelMarginCaption(captionContainer);
      } else {
        processFigureMarginCaption(captionContainer, doc);
      }
    } else {
      // Deal with table margin captions
      if (figureEl.classList.contains("tbl-parent")) {
        // This is table panel, so only grab the main caption
        const capDivEl = figureEl.querySelector("div.panel-caption");
        if (capDivEl) {
          capDivEl.classList.add("margin-caption");
          capDivEl.remove();
          figureEl.appendChild(capDivEl);
        }
      } else {
        // This is just a table, grab that caption
        const table = figureEl.querySelector("table");
        if (table) {
          processTableMarginCaption(table, doc);
        }
      }
    }
    removeCaptionClass(figureEl);
  });
};

const processMarginElsInCallouts = (doc: Document) => {
  const calloutNodes = doc.querySelectorAll("div.callout");
  calloutNodes.forEach((calloutNode) => {
    const calloutEl = calloutNode as Element;
    const collapseEl = calloutEl.querySelector(".callout-collapse");
    const isSimple = calloutEl.classList.contains("callout-style-simple");

    //Get the collapse classes (if any) to forward long
    const collapseClasses: string[] = [];
    if (collapseEl) {
      collapseEl.classList.forEach((clz) => collapseClasses.push(clz));
    }

    const marginNodes = calloutEl.querySelectorAll(
      ".callout-body-container .column-margin, .callout-body-container aside:not(.footnotes), .callout-body-container .aside:not(.footnotes)",
    );

    if (marginNodes.length > 0) {
      const marginArr = Array.from(marginNodes);
      marginArr.reverse().forEach((marginNode) => {
        const marginEl = marginNode as Element;
        collapseClasses.forEach((clz) => {
          marginEl.classList.add(clz);
        });
        marginEl.classList.add("callout-margin-content");
        if (isSimple) {
          marginEl.classList.add("callout-margin-content-simple");
        }

        calloutEl.after(marginEl);
      });
    }
  });
};

const processFigureOutputs = (doc: Document) => {
  // For any non-margin figures, we want to actually place the figure itself
  // into the column, and leave the caption as is, if possible
  const columnEls = doc.querySelectorAll(
    '[class^="column-"]:not(.column-margin), [class*=" column-"]:not(.column-margin)',
  );

  const moveColumnClasses = (fromEl: Element, toEl: Element) => {
    const clzList: string[] = [];
    for (const clz of fromEl.classList) {
      if (clz.startsWith("column-")) {
        clzList.push(clz);
      }
    }
    fromEl.classList.remove(...clzList);
    toEl.classList.add(...clzList);
  };

  for (const columnNode of columnEls) {
    // See if this is a code cell with a single figure output
    const columnEl = columnNode as Element;

    // If there is a single figure, then forward the column class onto that
    const figures = columnEl.querySelectorAll("figure img.figure-img");
    if (figures && figures.length === 1) {
      moveColumnClasses(columnEl, figures[0] as Element);
    } else {
      const layoutFigures = columnEl.querySelectorAll(
        ".quarto-layout-panel > figure.figure .quarto-layout-row",
      );
      if (layoutFigures && layoutFigures.length === 1) {
        moveColumnClasses(columnEl, layoutFigures[0] as Element);
      }
    }
  }
};

const processMarginElsInTabsets = (doc: Document) => {
  // Move margin elements inside tabsets into a separate container that appears
  // before the tabset- this will hold the margin content
  // quarto.js will detect tab changed events and propery show and hide elements
  // by marking them with a collapse class.

  const tabSetNodes = doc.querySelectorAll("div.panel-tabset");
  tabSetNodes.forEach((tabsetNode) => {
    const tabSetEl = tabsetNode as Element;
    const tabNodes = tabSetEl.querySelectorAll("div.tab-pane");

    const marginEls: Element[] = [];
    let count = 0;
    tabNodes.forEach((tabNode) => {
      const tabEl = tabNode as Element;
      const tabId = tabEl.id;

      const marginNodes = tabEl.querySelectorAll(
        ".column-margin, aside:not(.footnotes), .aside:not(.footnotes)",
      );

      if (tabId && marginNodes.length > 0) {
        const marginArr = Array.from(marginNodes);
        marginArr.forEach((marginNode) => {
          const marginEl = marginNode as Element;
          marginEl.classList.add("tabset-margin-content");
          marginEl.classList.add(`${tabId}-tab-margin-content`);
          if (count > 0) {
            marginEl.classList.add("collapse");
          }
          marginEls.push(marginEl);
        });
      }
      count++;
    });

    if (marginEls) {
      const containerEl = doc.createElement("div");
      containerEl.classList.add("tabset-margin-container");
      marginEls.forEach((marginEl) => {
        containerEl.appendChild(marginEl);
      });
      tabSetEl.before(containerEl);
    }
  });
};

interface MarginNodeProcessor {
  selector: string;
  canProcess(el: Element): boolean;
  process(el: Element, doc: Document): void;
}

const simpleMarginProcessor: MarginNodeProcessor = {
  selector: ".column-margin:not(.column-container)",
  canProcess(el: Element) {
    return el.classList.contains("column-margin") &&
      !el.classList.contains("column-container");
  },
  process(el: Element, doc: Document) {
    el.classList.remove("column-margin");
    addContentToMarginContainerForEl(el, el, doc);
  },
};

const footnoteMarginProcessor: MarginNodeProcessor = {
  selector: ".footnote-ref",
  canProcess(el: Element) {
    return el.classList.contains("footnote-ref");
  },
  process(el: Element, doc: Document) {
    if (el.hasAttribute("href")) {
      const target = el.getAttribute("href");
      if (target) {
        // First try to grab a the citation or footnote.
        const refId = target.slice(1);
        const refContentsEl = doc.getElementById(refId);
        if (refContentsEl) {
          // Find and remove the backlink
          const backLinkEl = refContentsEl.querySelector(".footnote-back");
          if (backLinkEl) {
            backLinkEl.remove();
          }

          const invalidParentTags = [
            "SPAN",
            "EM",
            "STRONG",
            "DEL",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
          ];
          const findValidParentEl = (el: Element): Element | undefined => {
            if (
              el.parentElement &&
              !invalidParentTags.includes(el.parentElement.tagName)
            ) {
              return el.parentElement;
            } else if (el.parentElement) {
              return findValidParentEl(el.parentElement);
            } else {
              return undefined;
            }
          };

          // Prepend the footnote mark
          if (refContentsEl.childNodes.length > 0) {
            const firstChild = refContentsEl.childNodes[0];
            // Prepend the reference identified (e.g. <sup>1</sup> and a non breaking space)
            firstChild.insertBefore(
              doc.createTextNode("\u00A0"),
              firstChild.firstChild,
            );

            firstChild.insertBefore(
              el.firstChild.cloneNode(true),
              firstChild.firstChild,
            );
          }
          const validParent = findValidParentEl(el);
          addContentToMarginContainerForEl(
            validParent || el,
            refContentsEl,
            doc,
          );
        }
      }
    }
  },
};

const referenceMarginProcessor: MarginNodeProcessor = {
  selector: "a[role='doc-biblioref']",
  canProcess(el: Element) {
    return el.hasAttribute("role") &&
      el.getAttribute("role") === "doc-biblioref";
  },
  process(el: Element, doc: Document) {
    if (el.hasAttribute("href")) {
      const target = el.getAttribute("href");
      if (target) {
        // First try to grab a the citation.
        const refId = target.slice(1);
        const refContentsEl = doc.getElementById(refId);

        // Walks up the parent stack until a figure element is found
        const findCaptionEl = (el: Element): Element | undefined => {
          if (el.parentElement?.tagName === "FIGCAPTION") {
            return el.parentElement;
          } else if (el.parentElement) {
            return findCaptionEl(el.parentElement);
          } else {
            return undefined;
          }
        };

        const findNonSpanParentEl = (el: Element): Element | undefined => {
          if (el.parentElement && el.parentElement.tagName !== "SPAN") {
            return el.parentElement;
          } else if (el.parentElement) {
            return findNonSpanParentEl(el.parentElement);
          } else {
            return undefined;
          }
        };

        // The parent is a figcaption that contains the reference.
        // The parent.parent is the figure
        const figureCaptionEl = findCaptionEl(el);
        if (refContentsEl && figureCaptionEl) {
          if (figureCaptionEl.classList.contains("margin-caption")) {
            figureCaptionEl.appendChild(refContentsEl.cloneNode(true));
          } else {
            addContentToMarginContainerForEl(
              figureCaptionEl,
              refContentsEl,
              doc,
            );
          }
        } else if (refContentsEl) {
          const nonSpanParent = findNonSpanParentEl(el);
          if (nonSpanParent) {
            addContentToMarginContainerForEl(
              nonSpanParent,
              refContentsEl,
              doc,
            );
          }
        }
      }
    }
  },
};

// Tests whether element is a margin container
const isContainer = (el: Element | null) => {
  return (
    el &&
    el.tagName === "DIV" &&
    el.classList.contains("column-container") &&
    el.classList.contains("column-margin")
  );
};

const isAlreadyInMargin = (el: Element): boolean => {
  const elInMargin = el.classList.contains("column-margin") ||
    (el.classList.contains("aside") &&
      !el.classList.contains("footnotes")) ||
    el.classList.contains("margin-caption");
  if (elInMargin) {
    return true;
  } else if (el.parentElement !== null) {
    return isAlreadyInMargin(el.parentElement);
  } else {
    return false;
  }
};

// Creates a margin container
const createMarginContainer = (doc: Document) => {
  const container = doc.createElement("div");
  container.classList.add("no-row-height");
  container.classList.add("column-margin");
  container.classList.add("column-container");
  return container;
};

const marginContainerForEl = (el: Element, doc: Document) => {
  // The elements direct parent is in the margin
  if (el.parentElement && isAlreadyInMargin(el.parentElement)) {
    return el.parentElement;
  }

  // If the container would be directly adjacent to another container
  // we should use that adjacent container
  if (el.nextElementSibling && isContainer(el.nextElementSibling)) {
    return el.nextElementSibling;
  }
  if (el.previousElementSibling && isContainer(el.previousElementSibling)) {
    return el.previousElementSibling;
  }

  // Check for a list or table
  const list = findOutermostParentElOfType(el, ["OL", "UL", "TABLE"]);
  if (list) {
    if (list.nextElementSibling && isContainer(list.nextElementSibling)) {
      return list.nextElementSibling;
    } else {
      const container = createMarginContainer(doc);
      if (list.parentNode) {
        list.parentNode.insertBefore(container, list.nextElementSibling);
      }
      return container;
    }
  }

  // Find the callout parent and create a container for the callout there
  // Walks up the parent stack until a callout element is found
  const findCalloutEl = (el: Element): Element | undefined => {
    if (el.parentElement?.classList.contains("callout")) {
      return el.parentElement;
    } else if (el.parentElement) {
      return findCalloutEl(el.parentElement);
    } else {
      return undefined;
    }
  };
  const calloutEl = findCalloutEl(el);
  if (calloutEl) {
    const container = createMarginContainer(doc);
    calloutEl.parentNode?.insertBefore(
      container,
      calloutEl.nextElementSibling,
    );
    return container;
  }

  // Deal with a paragraph
  const parentEl = el.parentElement;
  const cantContainBlockTags = ["P"];
  if (parentEl && cantContainBlockTags.includes(parentEl.tagName)) {
    // See if this para has a parent div with a container
    if (
      parentEl.parentElement &&
      parentEl.parentElement.tagName === "DIV" &&
      parentEl.nextElementSibling &&
      isContainer(parentEl.nextElementSibling)
    ) {
      return parentEl.nextElementSibling;
    } else {
      const container = createMarginContainer(doc);
      const wrapper = doc.createElement("div");
      parentEl.replaceWith(wrapper);
      wrapper.appendChild(parentEl);
      wrapper.appendChild(container);
      return container;
    }
  }

  // We couldn't find a container, so just cook one up and return
  const container = createMarginContainer(doc);
  el.parentNode?.insertBefore(container, el.nextElementSibling);
  return container;
};

const addContentToMarginContainerForEl = (
  el: Element,
  content: Element,
  doc: Document,
) => {
  const container = marginContainerForEl(el, doc);
  if (container) {
    container.appendChild(content);
  }
};

const findOutermostParentElOfType = (
  el: Element,
  tagNames: string[],
): Element | undefined => {
  let outEl = undefined;
  if (el.parentElement) {
    if (el.parentElement.tagName === "MAIN") {
      return outEl;
    } else {
      if (tagNames.includes(el.parentElement.tagName)) {
        outEl = el.parentElement;
      }
      outEl = findOutermostParentElOfType(el.parentElement, tagNames) || outEl;
      return outEl;
    }
  } else {
    return undefined;
  }
};

const hasContents = (id: string, doc: Document) => {
  const el = doc.getElementById(id);
  // Does the element exist
  if (el === null) {
    return false;
  }

  // Does it have any element children?
  if (el.children.length > 0) {
    return true;
  }

  // If it doesn't have any element children
  // see if there is any text
  return !!el.innerText.trim();
};

// Suggests a default column by inspecting sidebars
// if there are none or some, take up the extra space!
function suggestColumn(doc: Document) {
  const leftSidebar = hasContents(kSidebarId, doc);
  const leftToc = hasContents(kTocLeftSidebarId, doc);
  const rightSidebar = hasContents(kMarginSidebarId, doc);

  const columnClasses = getColumnClasses(doc);
  const leftContent = [...fullOccludeClz, ...leftOccludeClz].some((clz) => {
    return columnClasses.has(clz);
  });
  const rightContent = [...fullOccludeClz, ...rightOccludeClz].some((clz) => {
    return columnClasses.has(clz);
  });

  const leftUsed = leftSidebar || leftContent || leftToc;
  const rightUsed = rightSidebar || rightContent;

  if (leftUsed && rightUsed) {
    return "column-body";
  } else if (leftUsed) {
    return "column-page-right";
  } else if (rightUsed) {
    return "column-page-left";
  } else {
    return "column-page";
  }
}
const kSidebarId = "quarto-sidebar";
const kMarginSidebarId = "quarto-margin-sidebar";
const kTocLeftSidebarId = "quarto-sidebar-toc-left";

const fullOccludeClz = [
  "column-page",
  "column-screen",
  "column-screen-inset",
];
const leftOccludeClz = [
  "column-page-left",
  "column-screen-inset-left",
  "column-screen-left",
];
const rightOccludeClz = [
  "column-margin",
  "column-page-right",
  "column-screen-inset-right",
  "column-screen-right",
  "margin-caption",
  "margin-ref",
];

const getColumnClasses = (doc: Document) => {
  const classes = new Set<string>();
  const colNodes = getColumnLayoutElements(doc);
  for (const colNode of colNodes) {
    const colEl = colNode as Element;
    colEl.classList.forEach((clz) => {
      if (
        clz === "margin-caption" || clz === "margin-ref" ||
        clz.startsWith("column-")
      ) {
        classes.add(clz);
      }
    });
  }
  return classes;
};
