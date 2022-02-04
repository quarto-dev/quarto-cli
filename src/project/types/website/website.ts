/*
* website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { DOMParser, HTMLDocument } from "../../../core/deno-dom.ts";

import { resourcePath } from "../../../core/resources.ts";
import { dirAndStem } from "../../../core/path.ts";
import { contentType, isHtmlContent } from "../../../core/mime.ts";

import { kProject404File, ProjectContext } from "../../types.ts";
import { ProjectCreate, ProjectOutputFile, ProjectType } from "../types.ts";
import {
  Format,
  FormatExtras,
  kDependencies,
  kHtmlFinalizers,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  PandocFlags,
} from "../../../config/types.ts";
import { projectOffset, projectOutputDir } from "../../project-shared.ts";

import { isHtmlOutput } from "../../../config/format.ts";

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
  kSiteFavicon,
  kWebsite,
  websiteConfigString,
  websiteMetadataFields,
  websiteProjectConfig,
  websiteTitle,
} from "./website-config.ts";
import { updateAliases } from "./website-aliases.ts";
import { metadataHtmlDependencies } from "./website-meta.ts";
import {
  cookieConsentDependencies,
  websiteAnalyticsScriptFile,
} from "./website-analytics.ts";
import { htmlResourceResolverPostprocessor } from "./website-resources.ts";

import { defaultProjectType } from "../project-default.ts";
import { TempContext } from "../../../core/temp.ts";
import {
  listingHtmlDependencies,
  listingSupplementalFiles,
} from "./listing/website-listing.ts";
import { completeStagedFeeds } from "./listing/website-listing-feed.ts";
import { aboutHtmlDependencies } from "./about/website-about.ts";

export const kSiteTemplateDefault = "default";
export const kSiteTemplateBlog = "blog";

export const websiteProjectType: ProjectType = {
  type: kWebsite,
  typeAliases: ["site"],
  templates: [kSiteTemplateDefault, kSiteTemplateBlog],
  create: (title: string, template?: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "website"));
    return websiteTemplate(resourceDir, title, template);
  },

  libDir: "site_libs",
  outputDir: "_site",

  formatLibDirs: () =>
    defaultProjectType.formatLibDirs!().concat(["quarto-nav", "quarto-search"]),

  config: websiteProjectConfig,

  metadataFields: websiteMetadataFields,

  resourceIgnoreFields: () => [kWebsite, "site"],

  preRender: async (context: ProjectContext) => {
    await initWebsiteNavigation(context);
  },

  supplementRender: (
    project: ProjectContext,
    files: string[],
    incremental: boolean,
  ) => {
    const listingSupplements = listingSupplementalFiles(
      project,
      files,
      incremental,
    );
    return listingSupplements;
  },

  formatExtras: async (
    project: ProjectContext,
    source: string,
    flags: PandocFlags,
    format: Format,
    temp: TempContext,
  ): Promise<FormatExtras> => {
    if (isHtmlOutput(format.pandoc)) {
      // navigation extras for bootstrap enabled formats
      const extras = formatHasBootstrap(format)
        ? await websiteNavigationExtras(project, source, flags, format, temp)
        : {};

      // add some title related variables
      extras.pandoc = extras.pandoc || {};
      extras.metadata = extras.metadata || {};

      // title prefix if the project has a title and this isn't the home page
      const title = websiteTitle(project.config);
      if (title) {
        extras.pandoc = {
          [kTitlePrefix]: title,
        };
      }

      // dependency for favicon if we have one
      const favicon = websiteConfigString(kSiteFavicon, project.config);
      if (favicon) {
        const offset = projectOffset(project, source);
        extras.html = extras.html || {};
        extras.html.dependencies = extras.html.dependencies || [];
        extras.html.dependencies.push({
          name: kSiteFavicon,
          links: [{
            rel: "icon",
            href: offset + "/" + favicon,
            type: contentType(favicon),
          }],
        });
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
      extras.html[kHtmlFinalizers] = extras.html[kHtmlFinalizers] || [];
      extras.html[kMarkdownAfterBody] = extras.html[kMarkdownAfterBody] || [];
      extras.html[kHtmlPostprocessors]?.push(...[
        htmlResourceResolverPostprocessor(source, project),
      ]);

      // listings extras
      const hasBootstrap = formatHasBootstrap(format);
      if (hasBootstrap) {
        const htmlListingDependencies = await listingHtmlDependencies(
          source,
          project,
          format,
          temp,
          extras,
        );
        if (htmlListingDependencies) {
          const listingPostProcessor =
            htmlListingDependencies[kHtmlPostprocessors];
          if (listingPostProcessor) {
            extras.html[kHtmlPostprocessors]?.push(listingPostProcessor);
          }

          const listingAfterBody = htmlListingDependencies[kMarkdownAfterBody];
          if (listingAfterBody) {
            extras.html[kMarkdownAfterBody]?.push(listingAfterBody);
          }
          extras[kIncludeInHeader] = extras[kIncludeInHeader] || [];
          extras[kIncludeInHeader]!.push(
            ...htmlListingDependencies[kIncludeInHeader],
          );
          extras.html[kSassBundles] = extras.html[kSassBundles] || [];
          extras.html[kSassBundles]!.push(
            ...htmlListingDependencies[kSassBundles],
          );

          extras.html[kDependencies] = extras.html[kDependencies] || [];
          extras.html[kDependencies]?.push(
            ...htmlListingDependencies[kDependencies],
          );
        }

        // about extras
        const aboutDependencies = await aboutHtmlDependencies(
          source,
          project,
          format,
          temp,
          extras,
        );
        if (aboutDependencies) {
          extras.html[kHtmlPostprocessors]?.push(
            aboutDependencies[kHtmlPostprocessors],
          );

          extras.html[kSassBundles] = extras.html[kSassBundles] || [];
          extras.html[kSassBundles]!.push(
            ...aboutDependencies[kSassBundles],
          );
        }
      }

      // metadata html dependencies
      const htmlMetadataDependencies = metadataHtmlDependencies(
        source,
        project,
        format,
        extras,
      );
      extras.html[kHtmlPostprocessors]?.push(
        htmlMetadataDependencies[kHtmlPostprocessors],
      );
      extras.html[kMarkdownAfterBody]?.push(
        htmlMetadataDependencies[kMarkdownAfterBody],
      );

      // Add html analytics extras, if any
      const analyticsDependency = websiteAnalyticsScriptFile(project, temp);
      if (analyticsDependency) {
        extras[kIncludeInHeader] = extras[kIncludeInHeader] || [];
        extras[kIncludeInHeader]?.push(analyticsDependency);
      }
      const cookieDep = cookieConsentDependencies(project, temp);
      if (cookieDep) {
        // Inline script
        extras[kIncludeInHeader] = extras[kIncludeInHeader] || [];
        extras[kIncludeInHeader]?.push(
          cookieDep.scriptFile,
        );

        // dependency
        extras.html = extras.html || {};
        extras.html[kDependencies] = extras.html[kDependencies] || [];
        extras.html[kDependencies]?.push(cookieDep.dependency);

        extras.html[kHtmlPostprocessors] = extras.html[kHtmlPostprocessors] ||
          [];
        extras.html[kHtmlPostprocessors]?.push(cookieDep.htmlPostProcessor);
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
  // filter out outputFiles that shouldn't be indexed
  const doc404 = join(projectOutputDir(context), kProject404File);
  outputFiles = outputFiles.filter((file) => {
    return file.file !== doc404;
  });

  // update sitemap
  await updateSitemap(context, outputFiles, incremental);

  // update search index
  updateSearchIndex(context, outputFiles, incremental);

  // Any full content feeds need to be 'completed'
  completeStagedFeeds(context, outputFiles, incremental);

  // write redirecting index.html if there is none
  ensureIndexPage(context);

  // 'Resolve' any listing RSS feeds that are staged
  // Look for staged RSS feed files and inject full content into them
  // exemplar: updateSearchIndex

  // generate any page aliases
  await updateAliases(context, outputFiles, incremental);
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

function websiteTemplate(
  resourceDir: string,
  title: string,
  template?: string,
) {
  if (template === kSiteTemplateBlog) {
    const today = new Date();
    const secondPostDateStr = today.toLocaleDateString();
    today.setDate(today.getDate() - 3);
    const firstPostDateStr = today.toLocaleDateString();

    return {
      configTemplate: join(
        resourceDir,
        "templates",
        "blog",
        "_quarto-blog.ejs.yml",
      ),
      resourceDir,
      scaffold: () => [
        {
          name: "index",
          content: "",
          noEngineContent: true,
          title,
          yaml:
            'listing:\n  contents: posts\n  sort: "date desc"\n  type: default\n  categories: true',
        },
        {
          name: "index",
          subdirectory: "posts/welcome",
          title: "Welcome To My Blog",
          content:
            "This is the first post in a Quarto blog. Welcome!\n\n![](thumbnail.jpg)\n\nSince this post doesn't specify an explicit `image`, the first image in the post will be used in the listing page of posts.",
          noEngineContent: true,
          yaml:
            `author: "Tristan O'Malley"\ndate: "${firstPostDateStr}"\ncategories: [news]`,
          supporting: [
            join(resourceDir, "templates", "blog", "thumbnail.jpg"),
          ],
        },
        {
          name: "index",
          subdirectory: "posts/post-with-code",
          title: "Post With Code",
          content: "This is a post with executable code.",
          yaml:
            `author: "Harlow Malloc"\ndate: "${secondPostDateStr}"\ncategories: [news, code, analysis]\nimage: "image.jpg"`,
          supporting: [
            join(resourceDir, "templates", "blog", "image.jpg"),
          ],
        },
        {
          name: "about",
          content: "About this blog",
          title: "About",
          noEngineContent: true,
        },
      ],

      supporting: [
        "styles.css",
        {
          from: join("templates", "blog", "_metadata.yml"),
          to: join("posts", "_metadata.yml"),
        },
      ],
    };
  } else {
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "index",
          content:
            "This is a Quarto website.\n\nTo learn more about Quarto websites visit <https://quarto.org/docs/websites>.",
          title,
        },
        {
          name: "about",
          content: "About this site",
          title: "About",
        },
      ],

      supporting: [
        "styles.css",
      ],
    };
  }
}
