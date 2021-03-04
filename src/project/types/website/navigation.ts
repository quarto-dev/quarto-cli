/*
* navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join, relative } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { generate as generateUuid } from "uuid/v4.ts";

import { ld } from "lodash/mod.ts";

import { sessionTempDir } from "../../../core/temp.ts";
import { dirAndStem } from "../../../core/path.ts";

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
  left?: NavItem[];
  right?: NavItem[];
}

interface NavItem {
  text?: string;
  href?: string;
  icon?: string;
  menu?: NavItem[];
}

export async function websiteNavigation(
  inputDir: string,
  project: ProjectContext,
  navbarConfig: unknown,
): Promise<FormatExtras> {
  // get navbar paths (return if they already exist for this session)
  const navigationPaths = sessionNavigationPaths();

  if (!existsSync(navigationPaths.header)) {
    Deno.writeTextFileSync(
      navigationPaths.header,
      navbarCssTemplate({ height: 60 }),
    );
  }

  if (!existsSync(navigationPaths.body)) {
    const lines: string[] = [];
    if (typeof (navbarConfig) === "object") {
      const navbar = navbarConfig as NavMain;
      lines.push(
        navTemplate({
          type: navbar.type || "dark",
          background: navbar.background || "primary",
        }),
      );
      if (navbar.title || navbar.logo) {
        lines.push(kBeginNavBrand);
        if (navbar.logo) {
          const logo = "/" +
            projectRelativePath(project, inputDir, navbar.logo);
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
            lines.push(await navigationItem(project, inputDir, item));
          }
          lines.push(kEndNavItems);
        }
        if (Array.isArray(navbar.right)) {
          lines.push(kBeginRightNavItems);
          for (const item of navbar.right) {
            lines.push(await navigationItem(project, inputDir, item));
          }
          lines.push(kEndNavItems);
        }
        lines.push(kEndNavCollapse);
      }
      lines.push(kEndNav);
      Deno.writeTextFileSync(navigationPaths.body, lines.join("\n"));
    }
  }

  return {
    [kIncludeInHeader]: [navigationPaths.header],
    [kIncludeBeforeBody]: [navigationPaths.body],
  };
}

async function navigationItem(
  project: ProjectContext,
  inputDir: string,
  navItem: NavItem,
  level = 0,
) {
  if (navItem.href) {
    navItem = await resolveNavItem(project, inputDir, navItem.href, navItem);
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
    const menu: string[] = [];
    menu.push(
      navMenuTemplate({ id: generateUuid(), text: navItem.text || "" }),
    );
    for (const item of navItem.menu) {
      menu.push(await navigationItem(project, inputDir, item, level + 1));
    }
    menu.push(kEndNavMenu);
    return menu.join("\n");
  } else if (navItem.text) {
    if (navItem.text.match(/^\-+$/)) {
      return kNavMenuDivider;
    } else {
      return navMenuHeaderTemplate(navItem);
    }
  } else if (navItem.icon) {
    return "";
  } else {
    return "";
  }
}

async function resolveNavItem(
  project: ProjectContext,
  inputDir: string,
  href: string,
  navItem: NavItem,
): Promise<NavItem> {
  const projRelative = projectRelativePath(project, inputDir, href);
  if (projRelative) {
    const index = await inputTargetIndex(project, projRelative);
    if (index) {
      const title = index.metadata?.["title"] as string;
      const [hrefDir, hrefStem] = dirAndStem(projRelative);
      const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
      return {
        ...navItem,
        href: htmlHref,
        text: navItem.text || title,
      };
    } else {
      return {
        ...navItem,
        href: "/" + projRelative,
      };
    }
  } else {
    return navItem;
  }
}

function projectRelativePath(
  project: ProjectContext,
  inputDir: string,
  path: string,
) {
  path = join(inputDir, path);
  if (existsSync(path)) {
    return relative(project.dir, path);
  } else {
    return undefined;
  }
}

function sessionNavigationPaths() {
  const dir = join(sessionTempDir(), "website-navigation");
  ensureDirSync(dir);
  return {
    header: join(dir, "include-in-header.html"),
    body: join(dir, "include-before-body.html"),
  };
}
