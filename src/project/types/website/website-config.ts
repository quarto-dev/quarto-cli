/*
* website-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { extname } from "path/mod.ts";
import { ld } from "lodash/mod.ts";
import { formatKeys } from "../../../command/render/render.ts";

import {
  kDescription,
  kMetadataFormat,
  kTitle,
} from "../../../config/constants.ts";
import { isHtmlOutput } from "../../../config/format.ts";
import {
  formatFromMetadata,
  metadataAsFormat,
} from "../../../config/metadata.ts";
import { Format, Metadata } from "../../../config/types.ts";
import { mergeConfigs } from "../../../core/config.ts";
import { Sidebar } from "../../project-config.ts";

import { ProjectConfig, ProjectContext } from "../../types.ts";

export const kWebsite = "website";
// 'website' was previously 'site'
export const kSite = "site";

export const kSiteUrl = "site-url";
export const kSitePath = "site-path";
export const kSiteTitle = "title";
export const kSiteRepoUrl = "repo-url";
export const kSiteRepoBranch = "repo-branch";
export const kSiteRepoActions = "repo-actions";

export const kSiteNavbar = "navbar";
export const kSiteSidebar = "sidebar";
export const kSiteSidebarStyle = "style";
export const kSiteSidebarHeader = "header";
export const kSiteSidebarFooter = "footer";
export const kSitePageNavigation = "page-navigation";
export const kPageFooter = "page-footer";

export const kMarginHeader = "margin-header";
export const kMarginFooter = "margin-footer";

export const kContents = "contents";

export const kTwitterCard = "twitter-card";
export const kOpenGraph = "open-graph";

export const kCardStyle = "card-style";
export const kImage = "image";
export const kImageWidth = "image-width";
export const kImageHeight = "image-height";
export const kCreator = "creator";
export const kTwitterSite = "site";

export const kLocale = "locale";
export const kSiteName = "site-name";

export interface WebsiteConfig {
  [kSiteTitle]?: string;
  [kSiteUrl]?: string;
  [kSiteRepoUrl]?: string;
  [kSiteRepoBranch]?: string;
  [kSiteRepoActions]?: string;
  [kSiteNavbar]?: string;
  [kSiteSidebar]?: string;
  [kSitePageNavigation]?: boolean;
  [kPageFooter]?: string;
  [kOpenGraph]?: boolean | OpenGraphConfig;
  [kTwitterCard]?: boolean | TwitterCardConfig;
}

export interface TwitterCardConfig {
  [kTitle]?: string;
  [kDescription]?: string;
  [kCardStyle]?: "summary" | "summary_card_large";
  [kImage]?: string;
  [kImageWidth]?: number;
  [kImageHeight]?: number;
  [kTwitterSite]?: string;
  [kCreator]?: string;
}

export interface OpenGraphConfig {
  [kTitle]?: string;
  [kDescription]?: string;
  [kImage]?: string;
  [kImageWidth]?: number;
  [kImageHeight]?: number;
  [kLocale]?: string;
  [kSiteName]?: string;
}

type WebsiteConfigKey =
  | "title"
  | "site-url"
  | "site-path"
  | "repo-url"
  | "repo-branch"
  | "repo-actions"
  | "navbar"
  | "sidebar"
  | "page-navigation"
  | "page-footer"
  | "margin-header"
  | "margin-footer"
  | "search";

export function websiteConfigString(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (typeof (config) === "string") {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfigMetadata(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (typeof (config) === "object" && !Array.isArray(config)) {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfigArray(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (Array.isArray(config)) {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfig(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const site = project?.[kWebsite] as
    | Record<string, unknown>
    | undefined;

  if (site) {
    return site[name] as
      | Record<string, unknown>
      | string
      | Array<string>
      | undefined;
  } else {
    return undefined;
  }
}

export function websiteTitle(project?: ProjectConfig): string | undefined {
  return websiteConfigString(kSiteTitle, project);
}

export function websiteBaseurl(project?: ProjectConfig): string | undefined {
  return websiteConfigString(kSiteUrl, project);
}

export function websitePath(project?: ProjectConfig): string {
  let path = websiteConfigString(kSitePath, project);
  if (path) {
    if (!path.endsWith("/")) {
      path = path + "/";
    }
    return path;
  } else {
    const baseUrl = websiteBaseurl(project);
    if (baseUrl) {
      try {
        const url = new URL(baseUrl);
        let path = url.pathname;
        if (!path.endsWith("/")) {
          path = path + "/";
        }
        return path;
      } catch {
        return "/";
      }
    } else {
      return "/";
    }
  }
}

export function websiteRepoUrl(project?: ProjectConfig): string | undefined {
  const repoUrl = websiteConfigString(kSiteRepoUrl, project);
  if (repoUrl) {
    if (!repoUrl.endsWith("/")) {
      return repoUrl + "/";
    } else {
      return repoUrl;
    }
  } else {
    return undefined;
  }
}

export function websiteRepoBranch(project?: ProjectConfig): string {
  return websiteConfigString(kSiteRepoBranch, project) || "main";
}

export function websiteMetadataFields(): Array<string | RegExp> {
  return [kWebsite, kSite];
}

export function isGithubRepoUrl(url: string): boolean {
  return !!url.match(/^http[s]?:\/\/github\.com/);
}

export function websiteConfigActions(
  key: string,
  subkey: string,
  project?: ProjectConfig,
): string[] {
  const book = project?.[subkey] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    const value = book[key];
    if (typeof (value) === "string") {
      if (value === "none") {
        return [];
      } else {
        return [value];
      }
    } else if (Array.isArray(value)) {
      return value.map((x) => String(x));
    } else {
      return [];
    }
  } else {
    return [];
  }
}

// provide a project context that elevates html to the default
// format for documents (unless they explicitly declare another format)
export function websiteProjectConfig(
  _projectDir: string,
  config: ProjectConfig,
  forceHtml: boolean,
): Promise<ProjectConfig> {
  config = ld.cloneDeep(config);
  const format = config[kMetadataFormat] as
    | string
    | Record<string, unknown>
    | undefined;
  if (format !== undefined) {
    if (typeof (format) === "string") {
      if (!isHtmlOutput(format, true) && forceHtml) {
        config[kMetadataFormat] = {
          html: "default",
          [format]: "default",
        };
      }
    } else {
      const formats = Object.keys(format);
      const orderedFormats = {} as Record<string, unknown>;
      if (forceHtml) {
        const htmlFormatPos = formats.findIndex((format) =>
          isHtmlOutput(format, true)
        );
        if (htmlFormatPos !== -1) {
          const htmlFormatName = formats.splice(htmlFormatPos, 1)[0];
          orderedFormats[htmlFormatName] = format[htmlFormatName];
        } else {
          orderedFormats["html"] = "default";
        }
      }
      for (const formatName of formats) {
        orderedFormats[formatName] = format[formatName];
      }
      config[kMetadataFormat] = orderedFormats;
    }
  } else {
    config[kMetadataFormat] = "html";
  }

  // Resolve elements that could be paths to markdown and
  // ensure they are arrays so they can be merged
  const siteMeta = (config[kWebsite] || {}) as Metadata;
  if (siteMeta[kMarginHeader]) {
    siteMeta[kMarginHeader] = expandMarkdown(
      kMarginHeader,
      siteMeta[kMarginHeader],
    );
  }
  if (siteMeta[kMarginFooter]) {
    siteMeta[kMarginFooter] = expandMarkdown(
      kMarginFooter,
      siteMeta[kMarginFooter],
    );
  }
  config[kSite] = siteMeta;

  const sidebarRaw = siteMeta[kSiteSidebar];
  const sidebars =
    (Array.isArray(sidebarRaw)
      ? sidebarRaw
      : typeof (sidebarRaw) == "object"
      ? [sidebarRaw]
      : undefined) as Sidebar[] | undefined;

  // Resolve any sidebar headers
  sidebars?.forEach((sidebar) => {
    const headerRaw = sidebar[kSiteSidebarHeader];
    if (headerRaw) {
      sidebar[kSiteSidebarHeader] = expandMarkdown(
        kSiteSidebarHeader,
        headerRaw,
      );
    }
  });

  // Resolve any sidebar footer
  sidebars?.forEach((sidebar) => {
    const footerRaw = sidebar[kSiteSidebarFooter];
    if (footerRaw) {
      sidebar[kSiteSidebarFooter] = expandMarkdown(
        kSiteSidebarFooter,
        footerRaw,
      );
    }
  });

  return Promise.resolve(config);
}

export function websiteHtmlFormat(project: ProjectContext): Format {
  const projConfig: Metadata = project.config || {};
  const baseFormat = metadataAsFormat(projConfig);
  const format = formatFromMetadata(baseFormat, formatKeys(projConfig)[0]);
  return mergeConfigs(baseFormat, format);
}

function expandMarkdown(name: string, val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((pathOrMarkdown) => {
      return expandMarkdownFilePath(pathOrMarkdown);
    });
  } else if (typeof (val) == "string") {
    return [expandMarkdownFilePath(val)];
  } else {
    throw Error(`Invalid value for ${name}:\n${val}`);
  }
}

function expandMarkdownFilePath(val: string): string {
  if (existsSync(val)) {
    const fileContents = Deno.readTextFileSync(val);

    // If we are reading raw HTML, provide raw block indicator
    const ext = extname(val);
    if (ext === ".html") {
      return "```{=html}\n" + fileContents + "\n```";
    } else {
      return fileContents;
    }
  } else {
    return val;
  }
}
