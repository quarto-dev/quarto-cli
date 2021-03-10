/*
* navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { dirAndStem } from "../../../core/path.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import { kTitle } from "../../../config/constants.ts";
import { Format, FormatExtras, kBodyEnvelope } from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";

import { hasTableOfContents } from "../../../format/format-html.ts";

import { ProjectContext } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";
import { kNavbar, kSidebar } from "./website.ts";

const kAriaLabel = "aria-label";
const kCollapseBelow = "collapse-below";

type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

interface Navigation {
  header?: string;
  navbar?: Navbar;
  sidebars: Sidebar[];
}

interface Sidebar {
  title?: string;
  search?: boolean;
  contents: Array<SidebarItem | SidebarSection>;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface SidebarItem {
  href: string;
  text?: string;
  [kAriaLabel]?: string;
}

interface Navbar {
  title?: string;
  logo?: string;
  type?: "light" | "dark";
  background:
    | "light"
    | "dark"
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info";
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
  // alias navbar config
  const navbar = project.metadata?.[kNavbar] as Navbar;
  const sidebar = project.metadata?.[kSidebar] as Sidebar;
  if (typeof (navbar) !== "object" && typeof (sidebar) !== "object") {
    return;
  }

  // write the header
  const navstylesEjs = formatResourcePath("html", "templates/navstyles.ejs");
  navigation.header = renderEjs(navstylesEjs, { height: 60 });

  // create navbar
  navigation.navbar = await navbarEjsData(project, navbar);
}

export function websiteNavigation(
  input: string,
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  const extras: FormatExtras = {};

  const nav = {
    toc: hasTableOfContents(flags, format),
    navbar: navigation.navbar,
  };

  const envelope = {
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

  extras[kBodyEnvelope] = envelope;

  return extras;
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
    type: navbar.type || "light",
    background: navbar.background || "light",
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
    return await resolveNavItem(project, navItem.href, navItem);
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

async function resolveNavItem(
  project: ProjectContext,
  href: string,
  navItem: NavbarItem,
): Promise<NavbarItem> {
  if (!isExternalPath(href)) {
    const index = await inputTargetIndex(project, href);
    if (index) {
      const [hrefDir, hrefStem] = dirAndStem(href);
      const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
      const title = index.metadata?.[kTitle] as string ||
        ((hrefDir === "." && hrefStem === "index") ? "Home" : undefined);

      return {
        ...navItem,
        href: htmlHref,
        text: navItem.text || title,
      };
    } else {
      return {
        ...navItem,
        href: "/" + href,
      };
    }
  } else {
    return navItem;
  }
}

function isExternalPath(path: string) {
  return /^\w+:/.test(path);
}
