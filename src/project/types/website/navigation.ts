/*
* navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ensureDirSync, exists } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { sessionTempDir } from "../../../core/temp.ts";
import { dirAndStem } from "../../../core/path.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { EjsData, renderEjs } from "../../../core/ejs.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import {
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../../config/constants.ts";
import { FormatExtras } from "../../../config/format.ts";

import { ProjectContext } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";

const kNavbar = "navbar";
const kAriaLabel = "aria-label";
const kCollapseBelow = "collapse-below";

type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

interface NavMain {
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
  left?: NavItem[];
  right?: NavItem[];
  collapse?: "all" | "left" | "none";
  [kCollapseBelow]?: LayoutBreak;
}

interface NavItem {
  id?: string;
  text?: string;
  href?: string;
  icon?: string;
  [kAriaLabel]: string;
  menu?: NavItem[];
}

export function websiteNavigation(): FormatExtras {
  const navigationPaths = sessionNavigationPaths();

  const extras: FormatExtras = {};
  if (exists(navigationPaths.header)) {
    extras[kIncludeInHeader] = [navigationPaths.header];
  }
  if (exists(navigationPaths.body)) {
    extras[kIncludeBeforeBody] = [navigationPaths.body];
  }
  return extras;
}

export async function initWebsiteNavigation(project: ProjectContext) {
  // alias navbar config
  const navbar = project.metadata?.[kNavbar] as NavMain;
  if (typeof (navbar) !== "object") {
    return;
  }

  // prepare navbar for ejs
  const navbarData = await navbarEjsData(project, navbar);

  // get navbar paths
  const navigationPaths = sessionNavigationPaths();

  // write the header
  const navstylesEjs = formatResourcePath("html", "templates/navstyles.ejs");
  Deno.writeTextFileSync(
    navigationPaths.header,
    renderEjs(navstylesEjs, { height: 60 }),
  );

  // write the body
  const navbarEjs = formatResourcePath("html", "templates/navbar.ejs");
  Deno.writeTextFileSync(
    navigationPaths.body,
    renderEjs(navbarEjs, { nav: navbarData }),
  );
}

async function navbarEjsData(
  project: ProjectContext,
  navbar: NavMain,
): Promise<NavMain> {
  const data: NavMain = {
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
    data.left = new Array<NavItem>();
    for (let i = 0; i < navbar.left.length; i++) {
      data.left.push(await navigationItem(project, navbar.left[i]));
    }
  }
  if (navbar.right) {
    if (!Array.isArray(navbar.right)) {
      throw new Error("navbar 'right' must be an array of menu items");
    }
    data.right = new Array<NavItem>();
    for (let i = 0; i < navbar.right.length; i++) {
      data.right.push(await navigationItem(project, navbar.right[i]));
    }
  }

  return data;
}

async function navigationItem(
  project: ProjectContext,
  navItem: NavItem,
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
function uniqueMenuId(navItem: NavItem) {
  const id = pandocAutoIdentifier(navItem.text || navItem.icon || "", true);
  const number = menuIds.get(id) || 0;
  menuIds.set(id, number + 1);
  return `nav-menu-${id}${number ? ("-" + number) : ""}`;
}

async function resolveNavItem(
  project: ProjectContext,
  href: string,
  navItem: NavItem,
): Promise<NavItem> {
  if (!isExternalPath(href)) {
    const index = await inputTargetIndex(project, href);
    if (index) {
      const title = index.metadata?.["title"] as string;
      const [hrefDir, hrefStem] = dirAndStem(href);
      const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
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

function sessionNavigationPaths() {
  const dir = join(sessionTempDir(), "website-navigation");
  ensureDirSync(dir);
  return {
    header: join(dir, "include-in-header.html"),
    body: join(dir, "include-before-body.html"),
  };
}
