/*
 * website-navigation-md.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { dirname, extname, isAbsolute, join } from "path/mod.ts";
import { Document, Element } from "../../../core/deno-dom.ts";

import { Format, Metadata } from "../../../config/types.ts";
import { NavItem, Sidebar, SidebarItem } from "../../types.ts";

import {
  kBodyFooter,
  kBodyHeader,
  kMarginFooter,
  kMarginHeader,
  kWebsite,
} from "./website-constants.ts";
import { kTitle } from "../../../config/constants.ts";
import {
  BodyDecorators,
  flattenItems,
  Navigation,
  NavigationPagination,
  PageMargin,
} from "./website-shared.ts";
import { removeChapterNumber } from "./website-utils.ts";
import { MarkdownPipelineHandler } from "../../../core/markdown-pipeline.ts";
import { safeExistsSync } from "../../../core/path.ts";
import { md5Hash } from "../../../core/hash.ts";

const kSidebarTitleId = "quarto-int-sidebar-title";
const kNavbarTitleId = "quarto-int-navbar-title";
const kNavNextId = "quarto-int-next";
const kNavPrevId = "quarto-int-prev";
const kSidebarIdPrefix = "quarto-int-sidebar:";
const kBreadcrumbPrefix = "quarto-breadcrumbs";
const kNavbarIdPrefix = "quarto-int-navbar:";
const kToolsPrefix = "quarto-navbar-tools:";

export interface NavigationPipelineContext {
  source: string;
  format: Format;
  sidebar?: Sidebar;
  navigation?: Navigation;
  pageMargin?: PageMargin;
  bodyDecorators?: BodyDecorators;
  breadCrumbs?: SidebarItem[];
  pageNavigation: NavigationPagination;
}

export function navigationMarkdownHandlers(context: NavigationPipelineContext) {
  return [
    sidebarTitleHandler(context),
    navbarTitleHandler(context),
    nextPageTitleHandler(context),
    prevPageTitleHandler(context),
    sidebarContentsHandler(context),
    sidebarHeaderFooterHandler(context),
    navbarContentsHandler(context),
    footerHandler(context),
    marginHeaderFooterHandler(context),
    bodyHeaderFooterHandler(context),
    breadCrumbHandler(context),
  ];
}

function title(format: Format) {
  const site = format.metadata[kWebsite] as Metadata;
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

const sidebarTitleHandler = (
  context: NavigationPipelineContext,
): MarkdownPipelineHandler => {
  return {
    getUnrendered() {
      if (context.sidebar?.title) {
        return {
          inlines: {
            [kSidebarTitleId]: context.sidebar.title,
          },
        };
      } else {
        const mainTitle = title(context.format);
        if (mainTitle) {
          return {
            inlines: {
              [kSidebarTitleId]: mainTitle,
            },
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
};

const navbarTitleHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.navigation?.navbar?.title) {
        return {
          inlines: { [kNavbarTitleId]: context.navigation.navbar.title },
        };
      } else {
        const mainTitle = title(context.format);
        if (mainTitle) {
          return {
            inlines: {
              [kNavbarTitleId]: mainTitle,
            },
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
};

const nextPageTitleHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.pageNavigation.nextPage?.text) {
        return {
          inlines: { [kNavNextId]: context.pageNavigation.nextPage.text },
        };
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
};

const prevPageTitleHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.pageNavigation.prevPage?.text) {
        return {
          inlines: { [kNavPrevId]: context.pageNavigation.prevPage.text },
        };
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
};

const breadCrumbHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.breadCrumbs) {
        const markdown: Record<string, string> = {};
        for (const item of context.breadCrumbs) {
          if (item.text) {
            markdown[`${kBreadcrumbPrefix}-${textKey(item.text)}`] = item.text;
          }
        }
        return { inlines: markdown };
      }
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const breadCrumbs = doc.querySelectorAll(
        ".quarto-page-breadcrumbs .breadcrumb-item > a",
      );
      for (const breadCrumb of breadCrumbs) {
        const breadCrumbEl = breadCrumb as Element;
        const key = breadCrumbEl.innerHTML;
        const renderedEl = rendered[`${kBreadcrumbPrefix}-${textKey(key)}`];
        if (renderedEl) {
          breadCrumbEl.innerHTML = renderedEl.innerHTML;
        }
      }
    },
  };
};

// TODO: This is a pretty hack workaround to improve our matching in cases like book
// where we inject HTML right into the sidebar. Instead, we really need to switch this
// to requiring that each sidebar item has an id (either user provided or automatically)
// provisioned and then use that id to match for replacement. This is way too brittle and
// terrible
const textKey = (text: string) => {
  return text.replaceAll(/\s|&nbsp;/gm, "-").replaceAll(/"/gm, "'");
};
const sidebarContentsHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.sidebar?.contents) {
        const sidebarItems = flattenItems(context.sidebar?.contents, (_) => {
          return true;
        });

        const markdown: Record<string, string> = {};
        sidebarItems.forEach((item) => {
          if (item.text) {
            // Place sections using ID, place items using href
            if (item.sectionId) {
              markdown[`${kSidebarIdPrefix}${item.sectionId}`] = item.text;
            } else {
              markdown[`${kSidebarIdPrefix}${item.href}${textKey(item.text)}`] =
                item.text;
            }
          }
        });

        return { inlines: markdown };
      }
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const sidebarItemEls = doc.querySelectorAll(
        ".sidebar-item:not(.sidebar-item-section) .sidebar-item-text",
      );
      for (let i = 0; i < sidebarItemEls.length; i++) {
        const sidebarEl = sidebarItemEls[i] as Element;
        const href = sidebarEl.getAttribute("href");
        const link = sidebarEl.querySelector(".menu-text");
        if (link) {
          const text = textKey(link.innerHTML);
          const sidebarText = rendered[`${kSidebarIdPrefix}${href}${text}`];
          if (sidebarText) {
            link.innerHTML = sidebarText.innerHTML;
          }
        }
      }

      const sidebarSectionEls = doc.querySelectorAll(
        ".sidebar-item.sidebar-item-section .sidebar-item-text",
      );
      for (let i = 0; i < sidebarSectionEls.length; i++) {
        const sectionEl = sidebarSectionEls[i] as Element;
        const target = sectionEl.getAttribute("data-bs-target");

        if (target) {
          const id = target.slice(1);
          const sectionText = rendered[`${kSidebarIdPrefix}${id}`];
          if (sectionText) {
            const link = sectionEl.querySelector(".menu-text");
            if (link) {
              link.innerHTML = sectionText.innerHTML;
            }
          }
        }
      }
    },
  };
};

const navbarContentsHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.navigation?.navbar) {
        const markdown: Record<string, string> = {};
        const entries = [
          ...context.navigation.navbar.left || [],
          ...context.navigation.navbar.right || [],
        ];

        const addEntry = (entry: NavItem) => {
          if (typeof entry === "string") {
            markdown[`${kNavbarIdPrefix}${entry.trim()}`] = entry;
            return;
          }
          if (entry.text) {
            markdown[`${kNavbarIdPrefix}${entry.text.trim()}`] = entry.text;
          }
          if (entry.href) {
            markdown[`${kNavbarIdPrefix}${entry.href.trim()}`] = mdSafeHref(
              entry.href,
            );
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

        const tools = context.navigation.navbar.tools;
        if (tools) {
          tools.forEach((tool) => {
            if (tool.href) {
              markdown[`${kToolsPrefix}${tool.href.trim()}`] = mdSafeHref(
                tool.href,
              );
            }
          });
        }

        return { inlines: markdown };
      }
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const selectors = [
        ".navbar-nav .nav-item a.nav-link .menu-text",
        ".navbar-nav .dropdown-menu .dropdown-item .dropdown-text",
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

          // Any rendered hrefs for nav items
          const textParent = link.parentElement;
          if (textParent) {
            const href = textParent.getAttribute("href");
            if (href) {
              const renderedHref = rendered[`${kNavbarIdPrefix}${href}`];
              if (renderedHref) {
                textParent.setAttribute("href", renderedHref?.innerText);
              }
            }
          }
        }
      });

      // Any tools
      [".navbar .quarto-navbar-tools .quarto-navigation-tool"].forEach(
        (sel) => {
          const toolNodes = doc.querySelectorAll(sel);
          for (let i = 0; i < toolNodes.length; i++) {
            const toolEl = toolNodes[i] as Element;
            const href = toolEl.getAttribute("href");
            if (href) {
              const renderedHref = rendered[`${kToolsPrefix}${href}`];
              if (renderedHref) {
                toolEl.setAttribute("href", renderedHref?.innerText);
              }
            }
          }
        },
      );
    },
  };
};

const toHeaderFooterMarkdown = (
  source: string,
  prefix: string,
  content: string[],
) => {
  const markdown = content.map((con) => {
    return expandMarkdown(source, prefix, con);
  });
  return markdown.reduce(
    (previousValue, currentValue) => {
      return `${previousValue}\n:::{.${prefix}-item}\n${currentValue}\n:::\n`;
    },
    "",
  );
};

const toHeaderFooterContainer = (
  doc: Document,
  prefix: string,
  contentEl: Element,
) => {
  const containerEl = doc.createElement("div");
  containerEl.classList.add(`quarto-${prefix}`);
  for (const child of contentEl.children) {
    containerEl.appendChild(child);
  }
  return containerEl;
};

const sidebarHeaderFooterHandler = (context: NavigationPipelineContext) => {
  const kSidebarHeader = "sidebar-header";
  const kSidebarFooter = "sidebar-footer";

  return {
    getUnrendered() {
      const result: Record<string, string> = {};
      if (context.sidebar?.header) {
        if (context.sidebar?.header && context.sidebar?.header.length > 0) {
          result[kSidebarHeader] = toHeaderFooterMarkdown(
            context.source,
            kSidebarHeader,
            context.sidebar.header as string[],
          );
        }
      }
      if (context.sidebar?.footer) {
        if (context.sidebar?.footer && context.sidebar?.footer.length > 0) {
          result[kSidebarFooter] = toHeaderFooterMarkdown(
            context.source,
            kSidebarFooter,
            context.sidebar.footer as string[],
          );
        }
      }
      return { blocks: result };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const sidebarEl = doc.getElementById("quarto-sidebar");
      if (sidebarEl) {
        const renderedHeaderEl = rendered[kSidebarHeader];
        if (renderedHeaderEl) {
          const headerEl = toHeaderFooterContainer(
            doc,
            kSidebarHeader,
            renderedHeaderEl,
          );
          sidebarEl.insertBefore(headerEl, sidebarEl.firstChild);
        }
        const renderedFooterEl = rendered[kSidebarFooter];
        if (renderedFooterEl) {
          const footerEl = toHeaderFooterContainer(
            doc,
            kSidebarFooter,
            renderedFooterEl,
          );
          sidebarEl.appendChild(footerEl);
        }
      }
    },
  };
};

const bodyHeaderFooterHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      const result: Record<string, string> = {};
      if (context.bodyDecorators?.header) {
        result[kBodyHeader] = toHeaderFooterMarkdown(
          context.source,
          kBodyHeader,
          context.bodyDecorators?.header as string[],
        );
      }
      if (context.bodyDecorators?.footer) {
        result[kBodyFooter] = toHeaderFooterMarkdown(
          context.source,
          kBodyFooter,
          context.bodyDecorators?.footer as string[],
        );
      }
      return { blocks: result };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const mainEl = doc.querySelector("main");
      if (mainEl) {
        const renderedHeaderEl = rendered[kBodyHeader];
        if (renderedHeaderEl) {
          const headerEl = renderedHeaderEl.querySelector(
            `.${kBodyHeader}-item`,
          );
          if (headerEl) {
            const titleBlock = mainEl.querySelector("#title-block-header");
            const insertBefore = titleBlock?.nextElementSibling ||
              mainEl.childNodes[0] || null;
            for (const child of headerEl.children) {
              if (insertBefore) {
                mainEl.insertBefore(child, insertBefore);
              } else {
                mainEl.appendChild(child);
              }
            }
          }
        }

        const renderedFooterEl = rendered[kBodyFooter];
        if (renderedFooterEl) {
          const footerEl = renderedFooterEl.querySelector(
            `.${kBodyFooter}-item`,
          );
          if (footerEl) {
            for (const child of footerEl.children) {
              mainEl.appendChild(child);
            }
          }
        }
      }
    },
  };
};

// Render and place the margin and header and footer, if specified
const marginHeaderFooterHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      const result: Record<string, string> = {};
      if (context.navigation?.pageMargin) {
        const projectHeaders = context.navigation.pageMargin.header;
        const pageHeaderRaw = context.format.metadata[kMarginHeader];
        const pageHeaders: string[] = (pageHeaderRaw !== undefined)
          ? Array.isArray(pageHeaderRaw) ? pageHeaderRaw : [pageHeaderRaw]
          : [];
        const marginHeaders = [
          ...(projectHeaders || []),
          ...(pageHeaders || []),
        ];
        if (marginHeaders && marginHeaders.length > 0) {
          result[kMarginHeader] = toHeaderFooterMarkdown(
            context.source,
            kMarginHeader,
            marginHeaders,
          );
        }
        const projectFooters = context.navigation.pageMargin.footer;
        const pageFooterRaw = context.format.metadata[kMarginFooter];
        const pageFooters: string[] = pageFooterRaw !== undefined
          ? Array.isArray(pageFooterRaw) ? pageFooterRaw : [pageFooterRaw]
          : [];
        const marginFooters = [
          ...(projectFooters || []),
          ...(pageFooters || []),
        ].filter((item) => item !== undefined);
        if (marginFooters && marginFooters.length > 0) {
          result[kMarginFooter] = toHeaderFooterMarkdown(
            context.source,
            kMarginFooter,
            marginFooters,
          );
        }
      }
      return { blocks: result };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const sidebarEl = doc.getElementById("quarto-margin-sidebar");
      if (sidebarEl) {
        const renderedHeaderEl = rendered[kMarginHeader];
        if (renderedHeaderEl) {
          const headerEl = toHeaderFooterContainer(
            doc,
            kMarginHeader,
            renderedHeaderEl,
          );
          sidebarEl.insertBefore(headerEl, sidebarEl.firstChild);
        }
        const renderedFooterEl = rendered[kMarginFooter];
        if (renderedFooterEl) {
          const footerEl = toHeaderFooterContainer(
            doc,
            kMarginFooter,
            renderedFooterEl,
          );
          sidebarEl.appendChild(footerEl);
        }
      }
    },
  };
};

const kNavFooterPrefix = "footer-";
const footerHandler = (context: NavigationPipelineContext) => {
  return {
    getUnrendered() {
      if (context.navigation?.footer) {
        const markdown: Record<string, string> = {};
        const addEntry = (
          key: string,
          value: string | (string | NavItem)[],
        ) => {
          if (typeof value === "string") {
            markdown[`${kNavFooterPrefix}${key}`] = value;
          } else {
            value.forEach((navItem) => {
              if (typeof navItem === "object") {
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

        return { blocks: markdown };
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
};

function expandMarkdown(source: string, name: string, val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((pathOrMarkdown) => {
      return expandMarkdownFilePath(source, pathOrMarkdown);
    });
  } else if (typeof val == "string") {
    return [expandMarkdownFilePath(source, val)];
  } else {
    throw Error(`Invalid value for ${name}:\n${val}`);
  }
}

function expandMarkdownFilePath(source: string, path: string): string {
  const absPath = isAbsolute(path) ? path : join(dirname(source), path);
  if (safeExistsSync(absPath)) {
    const fileContents = Deno.readTextFileSync(absPath);

    // If we are reading raw HTML, provide raw block indicator
    const ext = extname(absPath);
    if (ext === ".html") {
      return "```{=html}\n" + fileContents + "\n```";
    } else {
      return fileContents;
    }
  } else {
    return path;
  }
}

export function mdSafeHref(href: string) {
  href = href.replaceAll("---", "\\-\\-\\-");
  href = href.replaceAll("--", "\\-\\-");
  href = href.replaceAll("@", "\\@");
  return href;
}
