/*
* proejct-website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ld } from "lodash/mod.ts";

import { join } from "path/mod.ts";
import {
  kLibDir,
  kOutputDir,
  kResources,
  ProjectMetadata,
} from "../project-context.ts";
import { resourcePath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { projectWebResources } from "../project-utils.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";
import { Format, FormatExtras } from "../../config/format.ts";
import { formatHasBootstrap } from "../../format/format-html.ts";
import {
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";

export const websiteProjectType: ProjectType = {
  type: "website",
  create: (_title: string, outputDir = "_site"): ProjectCreate => {
    const supportingDir = resourcePath(join("projects", "website"));

    return {
      metadata: {
        format: {
          html: {
            css: "styles.css",
          },
        },
        project: {
          [kOutputDir]: outputDir,
        },
      },

      scaffold: [
        {
          name: "index",
          content: "---\ntitle: Home\n---\n",
        },
        {
          name: "about",
          content: "---\ntitle: About\n---\n",
        },
      ],

      supporting: [
        "styles.css",
      ].map((path) => join(supportingDir, path)),
    };
  },

  config: (config?: ProjectMetadata) => {
    config = config || {};
    return {
      [kLibDir]: "libs",
      [kOutputDir]: "_site",
      [kResources]: [
        ...projectWebResources(),
        ...(config?.[kResources] || []),
      ],
      ...config,
    };
  },

  formatExtras: (format: Format): FormatExtras => {
    if (formatHasBootstrap(format)) {
      if (format.metadata["navbar"]) {
        return websiteNavbar(format.metadata["navbar"]);
      }
    }
    return {};
  },
};

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

function websiteNavbar(navbarConfig: unknown): FormatExtras {
  // TODO: css file (dynamic?) for e.g. logo sizing

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
