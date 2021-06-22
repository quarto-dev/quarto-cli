/*
* website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { DOMParser, HTMLDocument } from "deno_dom/deno-dom-wasm.ts";

import { ProjectContext, projectOffset } from "../../project-context.ts";
import { resourcePath } from "../../../core/resources.ts";
import { dirAndStem } from "../../../core/path.ts";
import { isHtmlContent } from "../../../core/mime.ts";

import {
  ProjectCreate,
  ProjectOutputFile,
  ProjectType,
} from "../project-type.ts";
import {
  Format,
  FormatExtras,
  isHtmlOutput,
  kDependencies,
  kHtmlPostprocessors,
} from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";

import {
  kIncludeInHeader,
  kPageTitle,
  kTitle,
  kTitlePrefix,
} from "../../../config/constants.ts";
import { formatHasBootstrap } from "../../../format/html/format-html-bootstrap.ts";

import {
  ensureIndexPage,
  initWebsiteNavigation,
  websiteNavigationExtras,
} from "./website-navigation.ts";

import { updateSitemap } from "./website-sitemap.ts";
import { updateSearchIndex } from "./website-search.ts";
import {
  kSite,
  websiteMetadataFields,
  websiteProjectConfig,
  websiteTitle,
} from "./website-config.ts";
import { updateAliases } from "./website-aliases.ts";
import { metadataHtmlPostProcessor } from "./website-meta.ts";
import { websiteAnalyticsExtras } from "./website-analytics.ts";

export const websiteProjectType: ProjectType = {
  type: "site",
  create: (title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "website"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: [
        {
          name: "index",
          content: "Home page",
          title,
        },
        {
          name: "about",
          content: "## About this site",
          title: "About",
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

  canServe: true,

  config: websiteProjectConfig,

  metadataFields: websiteMetadataFields,

  resourceIgnoreFields: () => [kSite],

  preRender: async (context: ProjectContext) => {
    await initWebsiteNavigation(context);
  },

  formatExtras: (
    project: ProjectContext,
    source: string,
    flags: PandocFlags,
    format: Format,
  ): Promise<FormatExtras> => {
    if (isHtmlOutput(format.pandoc)) {
      // navigation extras for bootstrap enabled formats
      const extras = formatHasBootstrap(format)
        ? websiteNavigationExtras(project, source, flags, format)
        : {};

      // add some title related variables
      extras.pandoc = extras.pandoc || {};
      extras.metadata = extras.metadata || {};

      // title prefix if the project has a title and this isn't the home page
      const title = websiteTitle(project.config);
      if (title) {
        extras.metadata = {
          [kTitlePrefix]: title,
        };
      }

      // pagetitle for home page if it has no title
      const offset = projectOffset(project, source);
      const [_dir, stem] = dirAndStem(source);
      const home = (stem === "index" && offset === ".");
      if (
        home && !format.metadata[kTitle] && !format.metadata[kPageTitle] &&
        title
      ) {
        extras.metadata[kPageTitle] = title;
      }

      // html metadata
      extras.html = extras.html || {};
      extras.html[kHtmlPostprocessors] = extras.html[kHtmlPostprocessors] || [];
      extras.html[kHtmlPostprocessors]?.push(
        metadataHtmlPostProcessor(source, project, format, extras),
      );

      // Add html analytics extras, if any
      const analyticsDependency = websiteAnalyticsExtras(format);
      if (analyticsDependency) {
        extras[kIncludeInHeader] = extras[kIncludeInHeader] || [];
        extras[kIncludeInHeader]?.push(analyticsDependency);
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
    await websitePostRender(
      context,
      incremental,
      websiteOutputFiles(outputFiles),
    );
  },
};

export interface WebsiteProjectOutputFile extends ProjectOutputFile {
  doc: HTMLDocument;
  doctype?: string;
}

export async function websitePostRender(
  context: ProjectContext,
  incremental: boolean,
  outputFiles: ProjectOutputFile[],
) {
  // update sitemap
  await updateSitemap(context, outputFiles, incremental);

  // update search index
  updateSearchIndex(context, outputFiles, incremental);

  // write redirecting index.html if there is none
  ensureIndexPage(context);

  // generate any page aliases
  await updateAliases(outputFiles, context);
}

export function websiteOutputFiles(outputFiles: ProjectOutputFile[]) {
  return outputFiles
    .filter((outputFile) => {
      return isHtmlContent(outputFile.file);
    })
    .map((outputFile) => {
      const contents = Deno.readTextFileSync(outputFile.file);
      const doctypeMatch = contents.match(/^<!DOCTYPE.*?>/);
      const doc = new DOMParser().parseFromString(contents, "text/html")!;
      return {
        ...outputFile,
        doc,
        doctype: doctypeMatch ? doctypeMatch[0] : undefined,
      };
    });
}
