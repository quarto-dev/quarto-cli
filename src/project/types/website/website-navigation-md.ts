/*
* website-navigation-markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { Format, Metadata } from "../../../config/types.ts";
import { NavbarItem, NavItem, Sidebar } from "../../project-config.ts";

import { kSite } from "./website-config.ts";
import { kTitle } from "../../../config/constants.ts";
import {
  computePageTitle,
  flattenItems,
  Navigation,
  NavigationPagination,
} from "./website-shared.ts";
import { removeChapterNumber } from "./website-navigation.ts";

const kSidebarTitleId = "quarto-int-sidebar-title";
const kNavbarTitleId = "quarto-int-navbar-title";
const kNavNextId = "quarto-int-next";
const kNavPrevId = "quarto-int-prev";
const kSidebarIdPrefix = "quarto-int-sidebar:";
const kNavbarIdPrefix = "quarto-int-navbar:";
const kMetaTitleId = "quarto-int-metatitle";


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
    site &&
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
        `.page-navigation .nav-page-previous a .nav-page-text`,
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

      const addEntry = (entry: NavbarItem) => {
        if (entry.text) {
          markdown[`${kNavbarIdPrefix}${entry.text.trim()}`] = entry.text;
        }
        if (entry.menu?.entries) {
          for (const childEntry of entry.menu) {
            addEntry(childEntry);
          }
        }
      };

      entries.forEach((entry) => {
        addEntry(entry);
      });
      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const selectors = [
      ".navbar-nav .nav-item a.nav-link",
      ".navbar-nav .dropdown-menu .dropdown-item",
      ".navbar-nav .dropdown-menu .dropdown-header",
    ];

    selectors.forEach((selector) => {
      const navItemEls = doc.querySelectorAll(selector);
      for (let i = 0; i < navItemEls.length; i++) {
        const link = navItemEls[i] as Element;
        const id = link.innerText.trim();
        if (id) {
          const renderedEl = rendered[`${kNavbarIdPrefix}${id}`];
          if (renderedEl) {
            link.innerHTML = renderedEl?.innerHTML;
          }
        }
      }
    });
  },
};

const kNavFooterPrefix = "footer-";
const footerHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.navigation?.footer) {
      const markdown: Record<string, string> = {};
      const addEntry = (key: string, value: string | (string | NavItem)[]) => {
        if (typeof (value) === "string") {
          markdown[`${kNavFooterPrefix}${key}`] = value;
        } else {
          value.forEach((navItem) => {
            if (typeof (navItem) === "object") {
              if (navItem.text) {
                markdown[
                  `${kNavFooterPrefix}${key}-${navItem.href || navItem.text}`
                ] = navItem.text;
              }
            }
          });
        }
      };

      if (context.navigation.footer.left) {
        addEntry("left", context.navigation.footer.left);
      }
      if (context.navigation.footer.center) {
        addEntry("center", context.navigation.footer.center);
      }
      if (context.navigation.footer.right) {
        addEntry("right", context.navigation.footer.right);
      }

      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const process = (key: string) => {
      // Process any simple markdown
      const footerEl = doc.querySelector(`.nav-footer .nav-footer-${key}`);
      if (footerEl) {
        const footer = rendered[`${kNavFooterPrefix}${key}`];
        if (footer) {
          footerEl.innerHTML = footer.innerHTML;
        }
      }

      // Process any items
      const navItemEls = doc.querySelectorAll(
        ".nav-footer .nav-item a.nav-link",
      );
      for (let i = 0; i < navItemEls.length; i++) {
        const link = navItemEls[i] as Element;
        const href = link.getAttribute("href");
        const id = href || link.innerText;
        if (id) {
          const renderedEl = rendered[`${kNavFooterPrefix}${key}-${id}`];

          if (renderedEl) {
            removeChapterNumber(renderedEl);
            link.innerHTML = renderedEl?.innerHTML;
          }
        }
      }
    };
    process("left");
    process("center");
    process("right");
  },
};

const titleMetaHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    const resolvedTitle = computePageTitle(context.format);
    if (resolvedTitle !== undefined) {
      return { [kMetaTitleId]: resolvedTitle };
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kMetaTitleId];
    if (renderedEl) {
      // Update the document title
      const el = doc.querySelector(
        `head title`,
      );
      if (el) {
        el.innerHTML = renderedEl.innerText;
      }

      // Update any social metadata
      const valueNames = ["og:title", "twitter:title"];
      const metaTags = doc.getElementsByTagName("meta");
      metaTags.forEach((metaTag) => {
        const name = metaTag.getAttribute("name");
        if (name !== null) {
          if (valueNames.includes(name)) {
            metaTag.setAttribute("content", renderedEl.innerText);
          }
        }
      });
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
  footerHandler,
  titleMetaHandler,
];
