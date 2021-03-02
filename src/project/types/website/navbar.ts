/*
* navbar.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { sessionTempFile } from "../../../core/temp.ts";

import {
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../../config/constants.ts";
import { FormatExtras } from "../../../config/format.ts";

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
  contents?: NavbarEntry[];
  ["contents-left"]?: NavbarEntry[];
  ["contents-right"]?: NavbarEntry[];
}

interface NavbarEntry {
  text?: string;
  href?: string;
  icon?: string;
  children?: NavbarEntry[];
}

const navTemplate = ld.template(
  `<nav class="navbar fixed-top navbar-expand-lg navbar-<%- type %> bg-<%- background %>">`,
);
const logoTemplate = ld.template(
  `<img src="<%- logo %>" class="d-inline-block align-top" />`,
);

export function websiteNavbar(navbarConfig: unknown): FormatExtras {
  const headerFile = sessionTempFile({ suffix: ".html" });
  Deno.writeTextFileSync(
    headerFile,
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
</style>`,
  );

  const navbarFile = sessionTempFile({ suffix: ".html" });
  const lines: string[] = [];
  if (typeof (navbarConfig) === "object") {
    const navbar = navbarConfig as Navbar;

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
  Deno.writeTextFileSync(navbarFile, lines.join("\n"));
  return {
    [kIncludeInHeader]: [headerFile],
    [kIncludeBeforeBody]: [navbarFile],
  };
}
