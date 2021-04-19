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

import {
  ProjectCreate,
  ProjectOutputFile,
  ProjectType,
} from "../project-types.ts";
import { Format, FormatExtras, isHtmlOutput } from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";

import { kPageTitle, kTitle, kTitlePrefix } from "../../../config/constants.ts";
import { formatHasBootstrap } from "../../../format/html/format-html-bootstrap.ts";

import {
  initWebsiteNavigation,
  websiteNavigationExtras,
} from "./website-navigation.ts";

import { updateSitemap } from "./website-sitemap.ts";
import { updateSearchIndex } from "./website-search.ts";
import {
  kSiteNavbar,
  kSiteSidebar,
  kSiteTitle,
  websiteMetadataFields,
} from "./website-config.ts";

export const websiteProjectType: ProjectType = {
  type: "site",
  create: (): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "website"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
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
      ],
    };
  },

  libDir: "site_libs",
  outputDir: "_site",

  formatLibDirs:
    () => ["bootstrap", "quarto-nav", "quarto-search", "quarto-html"],

  metadataFields: websiteMetadataFields,

  resourceIgnoreFields: () => [kSiteNavbar, kSiteSidebar],

  preRender: async (context: ProjectContext) => {
    await initWebsiteNavigation(context);
  },

  formatExtras: (
    project: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
  ): Promise<FormatExtras> => {
    if (isHtmlOutput(format.pandoc)) {
      // navigation extras for bootstrap enabled formats
      const extras = formatHasBootstrap(format)
        ? websiteNavigationExtras(project, input, flags, format)
        : {};

      // add some title related variables
      extras.pandoc = extras.pandoc || {};
      extras.metadata = extras.metadata || {};

      // title prefix if the project has a title and this isn't the home page
      const title = project.config?.[kSiteTitle] as string | undefined;
      if (title) {
        extras.metadata = {
          [kTitlePrefix]: title,
        };
      }

      // pagetitle for home page if it has no title
      const offset = projectOffset(project, input);
      const [_dir, stem] = dirAndStem(input);
      const home = (stem === "index" && offset === ".");
      if (
        home && !format.metadata[kTitle] && !format.metadata[kPageTitle] &&
        title
      ) {
        extras.metadata[kPageTitle] = title;
      }

      return Promise.resolve(extras);
    } else {
      return Promise.resolve({});
    }
  },

  postRender: async (
    context: ProjectContext,
    incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
    // update sitemap
    await updateSitemap(context, outputFiles, incremental);

    // update search index
    updateSearchIndex(context, outputFiles, incremental);
  },
};
