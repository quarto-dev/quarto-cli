/*
* navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { sessionTempDir } from "../../../core/temp.ts";

import {
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../../config/constants.ts";
import { FormatExtras } from "../../../config/format.ts";
import {
  kBeginLeftNavItems,
  kBeginNavBrand,
  kBeginNavCollapse,
  kBeginRightNavItems,
  kEndNav,
  kEndNavBrand,
  kEndNavCollapse,
  kEndNavItems,
  logoTemplate,
  navbarCssTemplate,
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
  items?: NavItem[];
}

export function websiteNavigation(navbarConfig: unknown): FormatExtras {
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
          lines.push(logoTemplate({ logo: navbar.logo }));
        }
        if (navbar.title) {
          lines.push(ld.escape(navbar.title));
        }
        lines.push(kEndNavBrand);
      }

      // if there are items, then create a toggler
      if (Array.isArray(navbar.left) || Array.isArray(navbar.right)) {
        lines.push(kBeginNavCollapse);
        if (Array.isArray(navbar.left)) {
          lines.push(kBeginLeftNavItems);
          lines.push(`
<li class="nav-item">
  <a class="nav-link" href="#">Home</a>
</li>
`);
          lines.push(kEndNavItems);
        }
        if (Array.isArray(navbar.right)) {
          lines.push(kBeginRightNavItems);
          lines.push(`
<li class="nav-item">
  <a class="nav-link" href="#">About</a>
</li>
`);

          lines.push(kEndNavItems);
        }

        lines.push(kEndNavCollapse);
      }

      lines.push(kEndNav);
    }
    Deno.writeTextFileSync(navigationPaths.body, lines.join("\n"));
  }

  return {
    [kIncludeInHeader]: [navigationPaths.header],
    [kIncludeBeforeBody]: [navigationPaths.body],
  };
}

function sessionNavigationPaths() {
  const dir = join(sessionTempDir(), "website-navigation");
  ensureDirSync(dir);
  return {
    header: join(dir, "include-in-header.html"),
    body: join(dir, "include-before-body.html"),
  };
}
