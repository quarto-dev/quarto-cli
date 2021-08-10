/*
* website-navigation-markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { Format, Metadata } from "../../../config/types.ts";
import { Sidebar } from "../../project-config.ts";

import { kSite } from "./website-config.ts";
import { kTitle } from "../../../config/constants.ts";
import {
  flattenItems,
  Navigation,
  NavigationPagination,
} from "./website-shared.ts";

const kSidebarTitleId = "quarto-int-sidebar-title";
const kNavbarTitleId = "quarto-int-navbar-title";
const kNavNextId = "quarto-int-next";
const kNavPrevId = "quarto-int-prev";
const kSidebarIdPrefix = "quarto-int-sidebar:";
const kNavbarIdPrefix = "quarto-int-navbar:";

export function createMarkdownEnvelope(
  format: Format,
  navigation: Navigation,
  nextAndPrev: NavigationPagination,
  sidebar?: Sidebar,
) {
  const envelope = markdownEnvelopeWriter();
  handlers.forEach((handler) => {
    const markdownRecords: Record<string, string> | undefined = handler
      .getUnrendered({
        format,
        sidebar,
        navigation,
        nextAndPrev,
      });
    if (markdownRecords) {
      Object.keys(markdownRecords).forEach((key) => {
        envelope.add(key, markdownRecords[key]);
      });
    }
  });
  return envelope.toMarkdown();
}

export function processMarkdownEnvelope(doc: Document) {
  // Reader for getting rendered elements
  const renderedMarkdown = readEnvelope(doc);
  handlers.forEach((handler) => {
    handler.processRendered(renderedMarkdown, doc);
  });
}

const kQuartoEnvelopeId = "quarto-render-envelope";
const readEnvelope = (doc: Document) => {
  const envelope = doc.getElementById(kQuartoEnvelopeId);
  const contents: Record<string, Element> = {};
  if (envelope) {
    const nodes = envelope.querySelectorAll("span[data-render-id]");
    nodes.forEach((node) => {
      const el = node as Element;
      const id = el.getAttribute("data-render-id");
      if (id) {
        contents[id] = el;
      }
    });
    envelope.remove();
  }
  return contents;
};

interface MarkdownRenderContext {
  format: Format;
  sidebar?: Sidebar;
  navigation?: Navigation;
  nextAndPrev: NavigationPagination;
}

interface MarkdownRenderHandler {
  getUnrendered: (
    context: MarkdownRenderContext,
  ) => Record<string, string> | undefined;
  processRendered: (rendered: Record<string, Element>, doc: Document) => void;
}

const markdownEnvelopeWriter = () => {
  const renderList: string[] = [];
  const hiddenSpan = (id: string, contents: string) => {
    return `[${contents}]{.hidden render-id="${id}"}`;
  };

  return {
    add: (id: string, value: string) => {
      renderList.push(hiddenSpan(id, value));
    },
    toMarkdown: () => {
      const contents = renderList.join("\n");
      return `\n:::{#${kQuartoEnvelopeId} .hidden}\n${contents}\n:::\n`;
    },
  };
};

function title(format: Format) {
  const site = (format.metadata[kSite] as Metadata);
  if (
    site[kTitle] &&
    typeof (site[kTitle]) !== "object"
  ) {
    return String(site[kTitle]);
  } else if (
    format.metadata[kTitle] &&
    typeof (format.metadata[kTitle]) !== "object"
  ) {
    return String(format.metadata[kTitle]);
  }
}

const sidebarTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.sidebar?.title) {
      return {
        [kSidebarTitleId]: context.sidebar.title,
      };
    } else {
      const mainTitle = title(context.format);
      if (mainTitle) {
        return {
          [kSidebarTitleId]: mainTitle,
        };
      }
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kSidebarTitleId];
    if (renderedEl) {
      const sidebarTitleEl =
        doc.querySelector("#quarto-sidebar .sidebar-title a") ||
        doc.querySelector("#quarto-sidebar .sidebar-title");
      if (sidebarTitleEl && sidebarTitleEl.innerText) {
        sidebarTitleEl.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const navbarTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.navigation?.navbar?.title) {
      return { [kNavbarTitleId]: context.navigation.navbar.title };
    } else {
      const mainTitle = title(context.format);
      if (mainTitle) {
        return {
          [kNavbarTitleId]: mainTitle,
        };
      }
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavbarTitleId];
    if (renderedEl) {
      const navbarTitleEl = doc.querySelector(
        "#quarto-header .navbar-brand .navbar-title",
      );
      if (navbarTitleEl && navbarTitleEl.innerText) {
        navbarTitleEl.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const nextPageTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.nextAndPrev.nextPage?.text) {
      return { [kNavNextId]: context.nextAndPrev.nextPage.text };
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavNextId];
    if (renderedEl) {
      const el = doc.querySelector(
        `.page-navigation .nav-page-next a .nav-page-text`,
      );
      if (el) {
        el.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const prevPageTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.nextAndPrev.prevPage?.text) {
      return { [kNavPrevId]: context.nextAndPrev.prevPage.text };
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavPrevId];
    if (renderedEl) {
      const el = doc.querySelector(
        `.page-navigation .nav-page-previous .nav-page-text a`,
      );
      if (el) {
        el.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const sidebarContentsHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.sidebar?.contents) {
      const sidebarItems = flattenItems(context.sidebar?.contents, (_) => {
        return true;
      });

      const markdown: Record<string, string> = {};
      sidebarItems.forEach((item) => {
        if (item.text) {
          markdown[`${kSidebarIdPrefix}${item.href || item.text}`] = item.text;
        }
      });
      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const sidebarItemEls = doc.querySelectorAll(
      "li.sidebar-item > a",
    );
    for (let i = 0; i < sidebarItemEls.length; i++) {
      const link = sidebarItemEls[i] as Element;
      const href = link.getAttribute("href");
      const sidebarText =
        rendered[`${kSidebarIdPrefix}${href || link.innerText}`];
      if (sidebarText) {
        link.innerHTML = sidebarText?.innerHTML;
      }
    }

    const sidebarSectionEls = doc.querySelectorAll(
      "ul.sidebar-section a.sidebar-section-item",
    );
    for (let i = 0; i < sidebarSectionEls.length; i++) {
      const link = sidebarSectionEls[i] as Element;
      const href = link.getAttribute("href");
      const div = link.querySelector("div.sidebar-section-item");

      if (div) {
        const id = href || div.innerText;
        if (id) {
          const sectionText = rendered[`${kSidebarIdPrefix}${id}`];
          if (sectionText) {
            div.innerHTML = sectionText?.innerHTML;
          }
        }
      }
    }
  },
};

const navbarContentsHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.navigation?.navbar) {
      const markdown: Record<string, string> = {};
      const entries = [
        ...context.navigation.navbar.left || [],
        ...context.navigation.navbar.right || [],
      ];
      entries.forEach((entry) => {
        if (entry.text) {
          markdown[`${kNavbarIdPrefix}${entry.href || entry.text}`] =
            entry.text;
        }
      });
      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const navItemEls = doc.querySelectorAll(
      ".navbar-nav .nav-item a.nav-link",
    );
    for (let i = 0; i < navItemEls.length; i++) {
      const link = navItemEls[i] as Element;
      const href = link.getAttribute("href");
      const id = href || link.innerText;
      if (id) {
        const renderedEl = rendered[`${kNavbarIdPrefix}${id}`];
        if (renderedEl) {
          link.innerHTML = renderedEl?.innerHTML;
        }
      }
    }
  },
};

const handlers: MarkdownRenderHandler[] = [
  sidebarTitleHandler,
  navbarTitleHandler,
  nextPageTitleHandler,
  prevPageTitleHandler,
  sidebarContentsHandler,
  navbarContentsHandler,
];
