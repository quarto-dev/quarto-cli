/*
* navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join, relative } from "path/mod.ts";
import { ensureDirSync, exists, existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { sessionTempDir } from "../../../core/temp.ts";
import { dirAndStem } from "../../../core/path.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import {
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../../config/constants.ts";
import { FormatExtras } from "../../../config/format.ts";

import { ProjectContext } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";

import {
  kBeginLeftNavItems,
  kBeginNavBrand,
  kBeginNavCollapse,
  kBeginRightNavItems,
  kEndNav,
  kEndNavBrand,
  kEndNavCollapse,
  kEndNavItems,
  kEndNavMenu,
  kNavMenuDivider,
  logoTemplate,
  navbarCssTemplate,
  navItemTemplate,
  navMenuHeaderTemplate,
  navMenuItemTemplate,
  navMenuTemplate,
  navTemplate,
} from "./navigation-html.ts";

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
}

interface NavItem {
  text?: string;
  href?: string;
  icon?: string;
  menu?: NavItem[];
}

const kNavbar = "navbar";

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

  // get navbar paths (return if they already exist for this session)
  const navigationPaths = sessionNavigationPaths();

  // write the header stuff
  Deno.writeTextFileSync(
    navigationPaths.header,
    navbarCssTemplate({ height: 60 }),
  );

  // write before body
  const lines: string[] = [];
  lines.push(
    navTemplate({
      type: navbar.type || "light",
      background: navbar.background || "light",
    }),
  );
  if (navbar.title || navbar.logo) {
    lines.push(kBeginNavBrand);
    if (navbar.logo) {
      const logo = "/" + navbar.logo;
      lines.push(logoTemplate({ logo }));
    }
    if (navbar.title) {
      lines.push(ld.escape(navbar.title));
    }
    lines.push(kEndNavBrand);
  }

  // if there are menu, then create a toggler
  if (Array.isArray(navbar.left) || Array.isArray(navbar.right)) {
    lines.push(kBeginNavCollapse);
    if (Array.isArray(navbar.left)) {
      lines.push(kBeginLeftNavItems);
      for (const item of navbar.left) {
        lines.push(await navigationItem(project, item));
      }
      lines.push(kEndNavItems);
    }
    if (Array.isArray(navbar.right)) {
      lines.push(kBeginRightNavItems);
      for (const item of navbar.right) {
        lines.push(await navigationItem(project, item));
      }
      lines.push(kEndNavItems);
    }
    lines.push(kEndNavCollapse);
  }
  lines.push(kEndNav);

  Deno.writeTextFileSync(navigationPaths.body, lines.join("\n"));
}

async function navigationItem(
  project: ProjectContext,
  navItem: NavItem,
  level = 0,
) {
  if (navItem.href) {
    navItem = await resolveNavItem(project, navItem.href, navItem);
    if (level === 0) {
      return navItemTemplate(navItem);
    } else {
      return navMenuItemTemplate(navItem);
    }
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

    const menu: string[] = [];
    menu.push(
      navMenuTemplate({
        id: uniqueMenuId(navItem),
        text: navItem.text || "",
        icon: navItem.icon,
      }),
    );
    for (const item of navItem.menu) {
      menu.push(await navigationItem(project, item, level + 1));
    }
    menu.push(kEndNavMenu);
    return menu.join("\n");
  } else if (navItem.text) {
    if (navItem.text.match(/^\-+$/)) {
      return kNavMenuDivider;
    } else {
      return navMenuHeaderTemplate(navItem);
    }
  } else {
    return "";
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
