/*
* website-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import * as ld from "../../../core/lodash.ts";

import { dirAndStem, pathWithForwardSlashes } from "../../../core/path.ts";

import { ProjectContext } from "../../types.ts";
import { Navbar, NavItem, Sidebar, SidebarItem } from "../../types.ts";
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
  websiteConfigMetadata,
} from "./website-config.ts";
import { cookieConsentEnabled } from "./website-analytics.ts";
import { Format, FormatExtras } from "../../../config/types.ts";
import { kPageTitle, kTitle, kTitlePrefix } from "../../../config/constants.ts";

export interface Navigation {
  navbar?: Navbar;
  sidebars: Sidebar[];
  pageNavigation?: boolean;
  footer?: NavigationFooter;
  pageMargin?: PageMargin;
  bodyDecorators?: BodyDecorators;
}

export interface NavigationFooter {
  background?: string;
  border?: string;
  left?: string | (NavItem | string)[];
  center?: string | (NavItem | string)[];
  right?: string | (NavItem | string)[];
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
      return undefined;
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
  let navbar = websiteConfigMetadata(kSiteNavbar, project.config) as
    | Navbar
    | undefined;
  if (typeof (navbar) !== "object") {
    navbar = undefined;
  }

  // read sidebar
  const sidebar = websiteConfig(kSiteSidebar, project.config);
  const sidebars =
    (Array.isArray(sidebar)
      ? sidebar
      : typeof (sidebar) == "object"
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
  const footerValue = (
    value?: unknown,
  ): string | NavItem[] | undefined => {
    if (typeof (value) === "string") {
      return value as string;
    } else if (Array.isArray(value)) {
      return value as NavItem[];
    } else {
      return undefined;
    }
  };

  const footer: NavigationFooter = {};
  const footerConfig = websiteConfig(kPageFooter, project.config);
  if (typeof (footerConfig) === "string") {
    // place the markdown in the center
    footer.center = footerConfig;
  } else if (!Array.isArray(footerConfig)) {
    // Map left center and right to the footer
    footer.left = footerValue(footerConfig?.left);
    footer.center = footerValue(footerConfig?.center);
    footer.right = footerValue(footerConfig?.right);
  }

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
