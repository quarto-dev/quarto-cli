/*
 * website.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";

import { resourcePath } from "../../../core/resources.ts";
import { dirAndStem } from "../../../core/path.ts";
import { contentType } from "../../../core/mime.ts";

import {
  InputTarget,
  kProject404File,
  kProjectLibDir,
  ProjectContext,
} from "../../types.ts";
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

import { isHtmlFileOutput } from "../../../config/format.ts";

import {
  kIncludeInHeader,
  kPageTitle,
  kTitle,
  kTitlePrefix,
} from "../../../config/constants.ts";
import { formatHasBootstrap } from "../../../format/html/format-html-info.ts";

import {
  ensureIndexPage,
  initWebsiteNavigation,
  websiteNavigationExtras,
  websiteNoThemeExtras,
} from "./website-navigation.ts";

import { updateSitemap } from "./website-sitemap.ts";
import { updateSearchIndex } from "./website-search.ts";
import {
  kDraftMode,
  kDrafts,
  kSiteFavicon,
  kWebsite,
} from "./website-constants.ts";
import {
  websiteConfigArray,
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
import {
  completeListingGeneration,
  listingHtmlDependencies,
  listingSupplementalFiles,
} from "./listing/website-listing.ts";
import { aboutHtmlDependencies } from "./about/website-about.ts";
import { resolveFormatForGiscus } from "./website-giscus.ts";
import {
  PandocOptions,
  RenderFile,
  RenderServices,
} from "../../../command/render/types.ts";
import { formatDate } from "../../../core/date.ts";
import { projectExtensionPathResolver } from "../../../extension/extension.ts";
import { websiteDraftPostProcessor } from "./website-draft.ts";

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
  cleanOutputDir: true,

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
    files: RenderFile[],
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
    services: RenderServices,
  ): Promise<FormatExtras> => {
    if (isHtmlFileOutput(format.pandoc)) {
      // navigation extras for bootstrap enabled formats
      const extras = formatHasBootstrap(format)
        ? await websiteNavigationExtras(
          project,
          source,
          flags,
          format,
          services.temp,
        )
        : await websiteNoThemeExtras(
          project,
          source,
          flags,
          format,
          services.temp,
        );

      // add some title related variables
      extras.pandoc = extras.pandoc || {};
      extras.metadata = extras.metadata || {};

      // Resolve any giscus information
      resolveFormatForGiscus(project, format);

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
      const home = stem === "index" && offset === ".";
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
        htmlResourceResolverPostprocessor(
          source,
          project,
          projectExtensionPathResolver(
            project.config?.project[kProjectLibDir] || "",
            project.dir,
          ),
        ),
      ]);
      extras.html[kHtmlPostprocessors].unshift(websiteDraftPostProcessor);

      // listings extras
      const hasBootstrap = formatHasBootstrap(format);

      const htmlListingDependencies = await listingHtmlDependencies(
        source,
        project,
        format,
        services.temp,
        extras,
      );
      if (htmlListingDependencies) {
        const listingPostProcessor =
          htmlListingDependencies[kHtmlPostprocessors];
        if (listingPostProcessor) {
          // Process listings early so if we inject content div, navigation and other
          // elements will wrap around
          extras.html[kHtmlPostprocessors]?.unshift(listingPostProcessor);
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

      if (hasBootstrap) {
        // about extras
        const aboutDependencies = await aboutHtmlDependencies(
          source,
          project,
          format,
          services.temp,
          extras,
        );
        if (aboutDependencies) {
          const aboutPostProcessor = aboutDependencies[kHtmlPostprocessors];
          if (aboutPostProcessor) {
            extras.html[kHtmlPostprocessors]?.push(aboutPostProcessor);
          }

          extras.html[kSassBundles] = extras.html[kSassBundles] || [];
          extras.html[kSassBundles]!.push(
            ...aboutDependencies[kSassBundles],
          );
          extras.html[kMarkdownAfterBody] = extras.html[kMarkdownAfterBody] ||
            [];
          extras.html[kMarkdownAfterBody]!.push(
            ...aboutDependencies[kMarkdownAfterBody],
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
      const analyticsDependency = websiteAnalyticsScriptFile(
        project,
        services.temp,
      );
      if (analyticsDependency) {
        extras[kIncludeInHeader] = extras[kIncludeInHeader] || [];
        extras[kIncludeInHeader]?.push(analyticsDependency);
      }
      const cookieDep = cookieConsentDependencies(
        project,
        format,
        services.temp,
      );
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

  filterInputTarget: (inputTarget: InputTarget, context: ProjectContext) => {
    const drafts = websiteConfigArray(kDrafts, context.config);
    const isDraft = drafts?.some((val) => {
      return val === inputTarget.input;
    });
    if (isDraft) {
      inputTarget.draft = true;
    }
    return inputTarget;
  },

  filterParams: async (options: PandocOptions) => {
    if (options.project) {
      const draftMode = websiteConfigString(kDraftMode, options.project.config);
      const drafts = websiteConfigArray(kDrafts, options.project.config);
      if (drafts || draftMode) {
        const draftsAbs = (drafts || []).map((path) => {
          return join(options.project!.dir, path);
        });
        return {
          [kDraftMode]: draftMode,
          [kDrafts]: draftsAbs,
        };
      }
    }
    return undefined;
  },
};

export interface WebsiteProjectOutputFile extends ProjectOutputFile {
  // doc: HTMLDocument;
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
  await updateSearchIndex(context, outputFiles, incremental);

  // Any full content feeds need to be 'completed'
  completeListingGeneration(context, outputFiles, incremental);

  // generate any page aliases
  await updateAliases(context, outputFiles, incremental);

  // write redirecting index.html if there is none
  await ensureIndexPage(context);
}

export function websiteOutputFiles(outputFiles: ProjectOutputFile[]) {
  return outputFiles
    .filter((outputFile) => {
      return isHtmlFileOutput(outputFile.format.pandoc);
    })
    .map((outputFile) => {
      const contents = Deno.readTextFileSync(outputFile.file);
      const doctypeMatch = contents.match(/^<!DOCTYPE.*?>/);
      // const doc = new DOMParser().parseFromString(contents, "text/html")!;
      return {
        ...outputFile,
        // doc,
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
    const secondPostDateStr = formatDate(today, "iso");
    today.setDate(today.getDate() - 3);
    const firstPostDateStr = formatDate(today, "iso");

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
            'listing:\n  contents: posts\n  sort: "date desc"\n  type: default\n  categories: true\n  sort-ui: false\n  filter-ui: false\npage-layout: full\ntitle-block-banner: true',
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
          title: "About",
          content: "About this blog",
          yaml:
            `image: profile.jpg\nabout:\n  template: jolla\n  links:\n    - icon: twitter\n      text: Twitter\n      href: https://twitter.com\n    - icon: linkedin\n      text: LinkedIn\n      href: https://linkedin.com\n    - icon: github\n      text: Github\n      href: https://github.com\n`,
          supporting: [
            join(resourceDir, "templates", "blog", "profile.jpg"),
          ],
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
