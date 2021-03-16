/*
* website-navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { dirAndStem, pathWithForwardSlashes } from "../../../core/path.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import { kTitle, kTocTitle } from "../../../config/constants.ts";
import {
  Format,
  FormatExtras,
  kBodyEnvelope,
  kDependencies,
} from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";

import {
  hasTableOfContents,
  hasTableOfContentsTitle,
} from "../../../format/format-html.ts";

import { ProjectContext } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";

import { websiteSearch, websiteSearchDependency } from "./website-search.ts";

export const kNavbar = "navbar";
export const kSidebar = "sidebar";
export const kSidebars = "sidebars";

const kAriaLabel = "aria-label";
const kBorderColor = "border-color";
const kCollapseBelow = "collapse-below";

type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

interface Navigation {
  header?: string;
  navbar?: Navbar;
  sidebars: Sidebar[];
}

interface Sidebar {
  title?: string;
  logo?: string;
  search?: boolean;
  "collapse-level"?: number;
  items: SidebarItem[];
  style: "anchored" | "floating";
}

interface SidebarItem {
  href?: string;
  items?: SidebarItem[];
  text?: string;
  [kAriaLabel]?: string;
  expanded?: boolean;
}

interface Navbar {
  title?: string;
  logo?: string;
  type?: "dark" | "light";
  background:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark";
  search?: boolean;
  left?: NavbarItem[];
  right?: NavbarItem[];
  collapse?: "all" | "left" | "none";
  [kCollapseBelow]?: LayoutBreak;
}

interface NavbarItem {
  id?: string;
  text?: string;
  href?: string;
  icon?: string;
  [kAriaLabel]?: string;
  menu?: NavbarItem[];
}

// static navigation (initialized during project preRender)
const navigation: Navigation = {
  sidebars: [],
};

export async function initWebsiteNavigation(project: ProjectContext) {
  // read config
  const { navbar, sidebars } = websiteNavigationConfig(project);
  if (!navbar && !sidebars) {
    return;
  }

  // write the header
  const navstylesEjs = formatResourcePath("html", "templates/navstyles.ejs");
  navigation.header = renderEjs(navstylesEjs, { height: navbar ? 56 : 0 });

  // navbar
  if (navbar) {
    navigation.navbar = await navbarEjsData(project, navbar);
  }

  // sidebars
  if (sidebars) {
    navigation.sidebars = await sidebarsEjsData(project, sidebars);
  }
}

export function websiteNavigationConfig(project: ProjectContext) {
  // read navbar and sidebar config
  let navbar = project.metadata?.[kNavbar] as Navbar | undefined;
  const sidebar = project.metadata?.[kSidebar] as Sidebar | undefined;
  let sidebars = project.metadata?.[kSidebars] as Sidebar[] | undefined;
  if (sidebar && !sidebars) {
    sidebars = [sidebar];
  }

  // validate navbar
  if (typeof (navbar) !== "object") {
    navbar = undefined;
  }

  // filter sidebars
  if (sidebars) {
    if (Array.isArray(sidebars)) {
      sidebars = sidebars.filter((sidebar) => typeof (sidebar) === "object");
    } else {
      sidebars = undefined;
    }
  }

  // return
  return { navbar, sidebars };
}

export function websiteNavigationExtras(
  project: ProjectContext,
  input: string,
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  // find the href and offset for this input
  const inputRelative = relative(project.dir, input);

  // get search dependency if we have search
  const searchDep = websiteSearchDependency(project, input);

  // return extras with bodyEnvelope
  return {
    [kTocTitle]: !hasTableOfContentsTitle(flags, format)
      ? "On this page"
      : undefined,
    [kDependencies]: searchDep ? [searchDep] : undefined,
    [kBodyEnvelope]: navigationBodyEnvelope(
      inputRelative,
      hasTableOfContents(flags, format),
    ),
  };
}

export function navigationBodyEnvelope(file: string, toc: boolean) {
  const href = inputFileHref(file);
  const nav = {
    toc,
    navbar: navigation.navbar,
    sidebar: expandedSidebar(href, sidebarForHref(href)),
  };

  return {
    header: navigation.header,
    before: renderEjs(
      formatResourcePath("html", "templates/nav-before-body.ejs"),
      { nav },
    ),
    after: renderEjs(
      formatResourcePath("html", "templates/nav-after-body.ejs"),
      { nav },
    ),
  };
}

async function sidebarsEjsData(project: ProjectContext, sidebars: Sidebar[]) {
  const ejsSidebars: Sidebar[] = [];
  for (let i = 0; i < sidebars.length; i++) {
    ejsSidebars.push(await sidebarEjsData(project, sidebars[i]));
  }
  return Promise.resolve(ejsSidebars);
}

async function sidebarEjsData(project: ProjectContext, sidebar: Sidebar) {
  sidebar = ld.cloneDeep(sidebar);

  // ensure title and search are present
  sidebar.title = sidebar.title !== undefined
    ? sidebar.title
    : sidebar.logo === undefined
    ? (project.metadata?.project?.title || "")
    : undefined;
  sidebar.search = websiteSearch(project) === "sidebar";

  await resolveSidebarItems(project, sidebar.items);

  return sidebar;
}

async function resolveSidebarItems(
  project: ProjectContext,
  items: SidebarItem[],
) {
  for (let i = 0; i < items.length; i++) {
    if (Object.keys(items[i]).includes("items")) {
      const subItems = items[i].items || [];
      for (let i = 0; i < subItems.length; i++) {
        subItems[i] = await resolveSidebarItem(project, subItems[i]);
      }
    } else {
      items[i] = await resolveSidebarItem(
        project,
        items[i] as SidebarItem,
      );
    }
  }
}

async function resolveSidebarItem(project: ProjectContext, item: SidebarItem) {
  if (item.href) {
    return await resolveItem(
      project,
      item.href,
      item,
    ) as SidebarItem;
  } else if (item.items) {
    await resolveSidebarItems(project, item.items);
    return item;
  } else {
    return item;
  }
}

function sidebarForHref(href: string) {
  for (const sidebar of navigation.sidebars) {
    if (containsHref(href, sidebar.items)) {
      return sidebar;
    }
  }
}

function containsHref(href: string, items: SidebarItem[]) {
  for (let i = 0; i < items.length; i++) {
    if (Object.keys(items[i]).includes("items")) {
      const subItems = items[i].items || [];
      const subItemsHasHref = containsHref(href, subItems);
      if (subItemsHasHref) {
        return true;
      }
    } else {
      if (items[i].href === href) {
        return true;
      }
    }
  }
  return false;
}

function expandedSidebar(href: string, sidebar?: Sidebar): Sidebar | undefined {
  if (sidebar) {
    // Walk through items and mark any items as 'expanded' if they
    // contain the item with this href
    const resolveExpandedItems = (href: string, items: SidebarItem[]) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (Object.keys(item).includes("items")) {
          if (resolveExpandedItems(href, item.items || [])) {
            item.expanded = true;
            return true;
          }
        } else if (item.href === href) {
          return true;
        }
      }
      return false;
    };

    // Copy and return the sidebar with expanded marked
    const expandedSidebar = ld.cloneDeep(sidebar);
    resolveExpandedItems(href, expandedSidebar.items);
    return expandedSidebar;
  }
}

async function navbarEjsData(
  project: ProjectContext,
  navbar: Navbar,
): Promise<Navbar> {
  const data: Navbar = {
    ...navbar,
    title: navbar.title !== undefined
      ? navbar.title
      : project.metadata?.project?.title || "",
    search: websiteSearch(project) === "navbar",
    type: navbar.type || "dark",
    background: navbar.background || "primary",
    logo: navbar.logo ? `/${navbar.logo}` : undefined,
    collapse: navbar.collapse || "all",
    [kCollapseBelow]: navbar.collapse === "none" ? ""
    : ("-" + (navbar[kCollapseBelow] || "lg")) as LayoutBreak,
  };

  // normalize nav items
  if (navbar.left) {
    if (!Array.isArray(navbar.left)) {
      throw new Error("navbar 'left' must be an array of menu items");
    }
    data.left = new Array<NavbarItem>();
    for (let i = 0; i < navbar.left.length; i++) {
      data.left.push(await navigationItem(project, navbar.left[i]));
    }
  }
  if (navbar.right) {
    if (!Array.isArray(navbar.right)) {
      throw new Error("navbar 'right' must be an array of menu items");
    }
    data.right = new Array<NavbarItem>();
    for (let i = 0; i < navbar.right.length; i++) {
      data.right.push(await navigationItem(project, navbar.right[i]));
    }
  }

  return data;
}

async function navigationItem(
  project: ProjectContext,
  navItem: NavbarItem,
  level = 0,
) {
  // make a copy we can mutate
  navItem = ld.cloneDeep(navItem);

  // resolve icon
  navItem.icon = navItem.icon
    ? !navItem.icon.startsWith("bi-") ? `bi-${navItem.icon}` : navItem.icon
    : navItem.icon;

  if (navItem.href) {
    return await resolveItem(project, navItem.href, navItem);
  } else if (navItem.menu) {
    // no sub-menus
    if (level > 0) {
      throw Error(
        `"${navItem.text || ""}" menu: navbar menus do not support sub-menus`,
      );
    }

    // text or icon is required
    if (!navItem.text && !navItem.icon) {
      throw Error(
        `"${navItem.text ||
          ""}" menu: you must specify a 'text' or 'icon' option for menus`,
      );
    }

    // recursively normalize nav items
    for (let i = 0; i < navItem.menu.length; i++) {
      navItem.menu[i] = await navigationItem(
        project,
        navItem.menu[i],
        level + 1,
      );
    }

    // provide id and ensure we have some text
    return {
      ...navItem,
      id: uniqueMenuId(navItem),
      text: navItem.text || "",
    };
  } else {
    return navItem;
  }
}

const menuIds = new Map<string, number>();
function uniqueMenuId(navItem: NavbarItem) {
  const id = pandocAutoIdentifier(navItem.text || navItem.icon || "", true);
  const number = menuIds.get(id) || 0;
  menuIds.set(id, number + 1);
  return `nav-menu-${id}${number ? ("-" + number) : ""}`;
}

async function resolveItem(
  project: ProjectContext,
  href: string,
  item: { href?: string; text?: string },
): Promise<{ href?: string; text?: string }> {
  if (!isExternalPath(href)) {
    const index = await inputTargetIndex(project, href);
    if (index) {
      const [hrefDir, hrefStem] = dirAndStem(href);
      const htmlHref = pathWithForwardSlashes(
        "/" + join(hrefDir, `${hrefStem}.html`),
      );
      const title = index.metadata?.[kTitle] as string ||
        ((hrefDir === "." && hrefStem === "index")
          ? project.metadata?.project?.title
          : undefined);

      return {
        ...item,
        href: htmlHref,
        text: item.text || title,
      };
    } else {
      return {
        ...item,
        href: "/" + href,
      };
    }
  } else {
    return item;
  }
}

function isExternalPath(path: string) {
  return /^\w+:/.test(path);
}

function inputFileHref(href: string) {
  const [hrefDir, hrefStem] = dirAndStem(href);
  const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
  return pathWithForwardSlashes(htmlHref);
}
