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

const navTemplate = ld.template(
  `<nav class="navbar fixed-top navbar-expand-lg navbar-<%- type %> bg-<%- background %>">`,
);
const logoTemplate = ld.template(
  `<img src="<%- logo %>" class="d-inline-block align-top" />`,
);

export function websiteNavigation(navbarConfig: unknown): FormatExtras {
  // get navbar paths (return if they already exist for this session)
  const navigationPaths = sessionNavigationPaths();

  if (!existsSync(navigationPaths.header)) {
    Deno.writeTextFileSync(
      navigationPaths.header,
      `
<style type="text/css">
.navbar-brand > img {
  max-height: 30px;
  width: auto;
  padding-right: 6px;
}
body {
  padding-top: 60px;
}
h1,h2,h3,h4,h5,h6 {
  padding-top: 60px; 
  margin-top: -60px 
}
</style>
`,
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
        lines.push(`<a class="navbar-brand" href="/">`);
        if (navbar.logo) {
          lines.push(logoTemplate({ logo: navbar.logo }));
        }
        if (navbar.title) {
          lines.push(ld.escape(navbar.title));
        }
        lines.push(`</a>`);
      }
      lines.push(`</nav>`);
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
