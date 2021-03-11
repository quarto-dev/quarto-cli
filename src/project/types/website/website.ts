/*
* website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ProjectContext, projectOffset } from "../../project-context.ts";
import { resourcePath } from "../../../core/resources.ts";
import { dirAndStem } from "../../../core/path.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";

import {
  kPageTitle,
  kTitle,
  kTitlePrefix,
  kVariables,
} from "../../../config/constants.ts";
import { formatHasBootstrap } from "../../../format/format-html.ts";

import {
  initWebsiteNavigation,
  websiteNavigationExtras,
} from "./navigation.ts";

export const kNavbar = "navbar";
export const kSidebar = "sidebar";
export const kSidebars = "sidebars";

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
    project: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
  ): FormatExtras => {
    // navigation extras for bootstrap enabled formats
    const extras = formatHasBootstrap(format)
      ? websiteNavigationExtras(project, input, flags, format)
      : {};

    // add some title related variables
    extras[kVariables] = {};

    // title prefix if the project has a title
    const title = project.metadata?.project?.title;
    if (title) {
      extras[kVariables] = {
        [kTitlePrefix]: project.metadata?.project?.title,
      };
    }

    // pagetitle for home page if it has no title
    if (!format.metadata[kTitle] && !format.metadata[kPageTitle]) {
      const offset = projectOffset(project, input);
      const [_dir, stem] = dirAndStem(input);
      if (stem === "index" && offset === ".") {
        extras[kVariables]![kPageTitle] = "Home";
      }
    }

    return extras;
  },

  metadataFields: () => [kNavbar, kSidebar, kSidebars],
};
