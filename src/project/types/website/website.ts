/*
* website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ProjectContext } from "../../project-context.ts";
import { resourcePath } from "../../../core/resources.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { formatHasBootstrap } from "../../../format/format-html.ts";

import { initWebsiteNavigation, websiteNavigation } from "./navigation.ts";

const kNavbar = "navbar";
const kSidebar = "sidebar";

export const websiteProjectType: ProjectType = {
  type: "website",
  create: (): ProjectCreate => {
    const supportingDir = resourcePath(join("projects", "website"));

    return {
      configTemplate: join(supportingDir, "templates", "_quarto.yml.ejs"),
      scaffold: [
        {
          name: "index",
          content: "Home page",
        },
        {
          name: "about",
          content: "## About this site",
          title: "About",
        },
      ],

      supporting: [
        "styles.css",
      ].map((path) => join(supportingDir, path)),
    };
  },

  libDir: "libs",
  outputDir: "_site",

  preRender: async (context: ProjectContext) => {
    await initWebsiteNavigation(context);
  },

  formatExtras: (
    _project: ProjectContext,
    format: Format,
  ): FormatExtras => {
    if (formatHasBootstrap(format)) {
      return websiteNavigation();
    } else {
      return {};
    }
  },

  metadataFields: () => [kNavbar, kSidebar],
};
