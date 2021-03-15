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
  kNavbar,
  kSidebar,
  kSidebars,
  websiteNavigationExtras,
} from "./website-navigation.ts";

import { websiteServe } from "./website-serve.ts";

import { kBaseUrl, updateSitemap } from "./website-sitemap.ts";
import { updateSearchIndex } from "./website-search.ts";

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
          format: "html",
        },
        {
          name: "about",
          content: "## About this site",
          title: "About",
          format: "html",
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

  serve: websiteServe,

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

    // is this the home page? (gets some special handling)
    const offset = projectOffset(project, input);
    const [_dir, stem] = dirAndStem(input);
    const home = (stem === "index" && offset === ".");

    // title prefix if the project has a title and this isn't the home page
    const title = project.metadata?.project?.title;
    if (title && !home) {
      extras[kVariables] = {
        [kTitlePrefix]: project.metadata?.project?.title,
      };
    }

    // pagetitle for home page if it has no title
    if (home && !format.metadata[kTitle] && !format.metadata[kPageTitle]) {
      extras[kVariables]![kPageTitle] = title || "Home";
    }

    return extras;
  },

  metadataFields: () => [kNavbar, kSidebar, kSidebars, kBaseUrl],

  postRender: async (
    context: ProjectContext,
    incremental: boolean,
    outputFiles: string[],
  ) => {
    // update sitemap
    await updateSitemap(context, outputFiles, incremental);

    // update search index
    updateSearchIndex(context, outputFiles, incremental);
  },
};
