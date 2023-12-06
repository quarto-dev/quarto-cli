/*
 * website-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";

import * as ld from "../../../core/lodash.ts";

import { dirAndStem, pathWithForwardSlashes } from "../../../core/path.ts";

import {
  NavigationItemObject,
  ProjectConfig,
  ProjectContext,
} from "../../types.ts";
import {
  Navbar,
  NavigationFooter,
  NavItem,
  Sidebar,
  SidebarItem,
} from "../../types.ts";
import {
  kBodyFooter,
  kBodyHeader,
  kMarginFooter,
  kMarginHeader,
  kPageFooter,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteSidebar,
  kWebsite,
} from "./website-constants.ts";

import {
  websiteConfig,
  websiteConfigArray,
  websiteConfigBoolean,
} from "./website-config.ts";
import { cookieConsentEnabled } from "./website-analytics.ts";
import { Format, FormatExtras } from "../../../config/types.ts";
import { kPageTitle, kTitle, kTitlePrefix } from "../../../config/constants.ts";
export { type NavigationFooter } from "../../types.ts";

export interface Navigation {
  navbar?: Navbar;
  sidebars: Sidebar[];
  pageNavigation?: boolean;
  footer?: NavigationFooter;
  pageMargin?: PageMargin;
  bodyDecorators?: BodyDecorators;
  breadCrumbs?: SidebarItem[];
}

export interface NavigationPagination {
  nextPage?: SidebarItem;
  prevPage?: SidebarItem;
}

export interface PageMargin {
  header?: string[];
  footer?: string[];
}

export interface BodyDecorators {
  header?: string[];
  footer?: string[];
}

export function computePageTitle(
  format: Format,
  extras?: FormatExtras,
): string | undefined {
  const meta = extras?.metadata || {};
  const pageTitle = meta[kPageTitle] || format.metadata[kPageTitle];
  const titlePrefix = extras?.pandoc?.[kTitlePrefix] ||
    (format.metadata[kWebsite] as Record<string, unknown>)?.[kTitle];
  const title = format.metadata[kTitle];

  if (pageTitle !== undefined) {
    return pageTitle as string;
  } else if (titlePrefix !== undefined) {
    // If the title prefix is the same as the title, don't include it as a prefix
    if (titlePrefix === title) {
      return title as string;
    } else if (title !== undefined) {
      return titlePrefix + " - " + title;
    } else {
      return titlePrefix + "";
    }
  } else {
    return title as string;
  }
}

export function inputFileHref(href: string) {
  const [hrefDir, hrefStem] = dirAndStem(href);
  const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
  return pathWithForwardSlashes(htmlHref);
}

export function websiteNavigationConfig(project: ProjectContext) {
  // read navbar
  let navbar = websiteConfig(kSiteNavbar, project.config) as
    | Navbar
    | undefined;
  if (typeof navbar === "boolean" && navbar) {
    navbar = { background: "primary" };
  } else if (typeof navbar !== "object") {
    navbar = undefined;
  }

  // read sidebar
  const sidebar = websiteConfig(kSiteSidebar, project.config);
  const sidebars =
    (Array.isArray(sidebar)
      ? sidebar
      : typeof sidebar == "object"
      ? [sidebar]
      : undefined) as Sidebar[] | undefined;

  // Ensure that sidebars have the complete values that are expected
  if (sidebars && sidebars[0]) {
    if (sidebars[0].style === undefined) {
      sidebars[0].style = "floating";
    }

    if (sidebars[0].contents === undefined) {
      sidebars[0].contents = [];
    }

    if (sidebars[0].tools === undefined) {
      sidebars[0].tools = [];
    }

    // convert contents: auto into items
    for (const sb of sidebars) {
      if (sb.contents && !Array.isArray(sb.contents)) {
        if (typeof (sb.contents) === "string") {
          if (sb.contents === "auto") {
            sb.contents = [{ auto: true }];
          } else {
            sb.contents = [{ auto: sb.contents }];
          }
        } else {
          sb.contents = [sb.contents as SidebarItem];
        }
      }
    }
  }

  // if there is more than one sidebar then propagate options from the
  // first sidebar to the others
  if (sidebars && sidebars.length > 1) {
    const sidebarOptions = ld.cloneDeep(sidebars[0]) as Sidebar;
    delete sidebarOptions.id;
    delete sidebarOptions.title;
    sidebarOptions.contents.splice(0, sidebarOptions.contents.length);
    for (let i = 1; i < sidebars.length; i++) {
      sidebars[i] = {
        ...sidebarOptions,
        ...sidebars[i],
      };
    }
  }

  // read the page navigation
  const pageNavigation = websiteConfigBoolean(
    kSitePageNavigation,
    false,
    project.config,
  );

  // read any footer
  const footer: NavigationFooter = resolvePageFooter(project.config);

  // Ensure there is a spot for cookie-consent to place a link
  if (footer.center === undefined && cookieConsentEnabled(project)) {
    footer.center = " ";
  }

  const pageMargin: PageMargin = {};
  const headerVal = websiteConfigArray(kMarginHeader, project.config);
  if (headerVal) {
    pageMargin.header = headerVal;
  }
  const footerVal = websiteConfigArray(kMarginFooter, project.config);
  if (footerVal) {
    pageMargin.footer = footerVal;
  }

  const bodyDecorators: BodyDecorators = {};
  const bodyHeaderVal = websiteConfigArray(kBodyHeader, project.config);
  if (bodyHeaderVal) {
    bodyDecorators.header = bodyHeaderVal;
  }
  const bodyFooterVal = websiteConfigArray(kBodyFooter, project.config);
  if (bodyFooterVal) {
    bodyDecorators.footer = bodyFooterVal;
  }

  // return
  return {
    navbar,
    sidebars,
    pageNavigation,
    footer,
    pageMargin,
    bodyDecorators,
  };
}

export function resolvePageFooter(config?: ProjectConfig) {
  const footerValue = (
    value?: unknown,
  ): string | NavItem[] | undefined => {
    if (typeof value === "string") {
      return value as string;
    } else if (Array.isArray(value)) {
      return value as NavItem[];
    } else {
      return undefined;
    }
  };

  const footer: NavigationFooter = {};
  const footerConfig = websiteConfig(kPageFooter, config);
  if (typeof footerConfig === "string") {
    // place the markdown in the center
    footer.center = footerConfig;
  } else if (!Array.isArray(footerConfig)) {
    // Map left center and right to the footer
    footer.left = footerValue(footerConfig?.left);
    footer.center = footerValue(footerConfig?.center);
    footer.right = footerValue(footerConfig?.right);
  }
  return footer;
}

export function flattenItems(
  sidebarItems: SidebarItem[],
  includeItem: (item: SidebarItem) => boolean,
) {
  const items: SidebarItem[] = [];
  const flatten = (sidebarItem: SidebarItem) => {
    if (includeItem(sidebarItem)) {
      items.push(sidebarItem);
    }
    if (sidebarItem.contents) {
      items.push(...flattenItems(sidebarItem.contents, includeItem));
    }
  };
  sidebarItems.forEach(flatten);
  return items;
}

export function breadCrumbs(href: string, sidebar?: Sidebar) {
  if (sidebar?.contents) {
    const crumbs: SidebarItem[] = [];

    // find the href in the sidebar
    const makeBreadCrumbs = (href: string, sidebarItems?: SidebarItem[]) => {
      if (sidebarItems) {
        for (const item of sidebarItems) {
          if (item.href === href) {
            crumbs.push(item);
            return true;
          } else {
            if (item.contents) {
              if (makeBreadCrumbs(href, item.contents)) {
                // If this 'section' doesn't have an href, then just use the first
                // child as the href
                const breadCrumbItem = { ...item };
                if (
                  !breadCrumbItem.href && breadCrumbItem.contents &&
                  breadCrumbItem.contents.length > 0
                ) {
                  breadCrumbItem.href = breadCrumbItem.contents[0].href;
                }

                crumbs.push(breadCrumbItem);
                return true;
              }
            }
          }
        }
        return false;
      } else {
        return false;
      }
    };
    makeBreadCrumbs(href, sidebar.contents);
    return crumbs.reverse();
  } else {
    return [];
  }
}

// static navigation (initialized during project preRender)
export const navigation: Navigation = {
  sidebars: [],
};

export function sidebarForHref(href: string, format: Format) {
  // if there is a single sidebar then it applies to all hrefs
  if (navigation.sidebars.length === 1) {
    return navigation.sidebars[0];
  } else {
    const explicitSidebar = navigation.sidebars.find((sidebar) => {
      return sidebar.id === format.metadata[kSiteSidebar];
    });
    if (explicitSidebar) {
      return explicitSidebar;
    } else {
      const containingSidebar = navigation.sidebars.find((sidebar) => {
        return containsHref(href, sidebar.contents);
      });
      if (containingSidebar) {
        return containingSidebar;
      } else {
        return undefined;
      }
    }
  }
}

// Given a sidebar, this function will look through the navbar items and attempt
// to find a matching NavItem from the Navbar
export function navbarItemForSidebar(sidebar: Sidebar, format: Format) {
  const findNavItemWithSidebar = (navItems: NavItem[] | undefined) => {
    if (navItems) {
      const navItem = navItems.find((val: NavItem) => {
        let href: string | undefined;
        if (typeof val === "object") {
          href = (val as NavigationItemObject).href;
        } else {
          href = val;
        }
        if (href) {
          const navSidebar = sidebarForHref(
            href,
            format,
          );
          if (navSidebar === sidebar) {
            return true;
          }
        }
        return false;
      });
      if (navItem) {
        return navItem;
      }
    }
  };

  const leftNavItem = findNavItemWithSidebar(navigation.navbar?.left);
  if (leftNavItem) {
    return leftNavItem;
  }

  const rightNavItem = findNavItemWithSidebar(navigation.navbar?.right);
  if (rightNavItem) {
    return rightNavItem;
  }
  return undefined;
}

export function containsHref(href: string, items: SidebarItem[]) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].href && items[i].href === href) {
      return true;
    } else if (Object.keys(items[i]).includes("contents")) {
      const subItems = items[i].contents || [];
      const subItemsHasHref = containsHref(href, subItems);
      if (subItemsHasHref) {
        return true;
      }
    } else {
      if (itemHasNavTarget(items[i], href)) {
        return true;
      }
    }
  }
  return false;
}

export function itemHasNavTarget(item: SidebarItem, href: string) {
  return item.href === href ||
    item.href === href.replace(/\/index\.html/, "/");
}
