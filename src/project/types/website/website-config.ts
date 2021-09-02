/*
* website-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

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

import { ProjectConfig, ProjectContext } from "../../types.ts";

export const kSite = "site";

export const kSiteTitle = "title";
export const kSiteUrl = "site-url";
export const kSitePath = "site-path";
export const kSiteRepoUrl = "repo-url";
export const kSiteRepoBranch = "repo-branch";
export const kSiteRepoActions = "repo-actions";

export const kSiteNavbar = "navbar";
export const kSiteSidebar = "sidebar";
export const kSiteSidebarStyle = "style";
export const kSitePageNavigation = "page-navigation";
export const kSiteFooter = "footer";

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
  [kSiteFooter]?: string;
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

export function websiteConfig(
  name:
    | "title"
    | "site-url"
    | "site-path"
    | "repo-url"
    | "repo-branch"
    | "repo-actions"
    | "navbar"
    | "sidebar"
    | "page-navigation"
    | "footer",
  project?: ProjectConfig,
) {
  const site = project?.[kSite] as
    | Record<string, unknown>
    | undefined;

  if (site) {
    return site[name] as Record<string, unknown> | string | undefined;
  } else {
    return undefined;
  }
}

export function websiteTitle(project?: ProjectConfig): string | undefined {
  return websiteConfig(kSiteTitle, project) as string | undefined;
}

export function websiteBaseurl(project?: ProjectConfig): string | undefined {
  return websiteConfig(kSiteUrl, project) as string | undefined;
}

export function websitePath(project?: ProjectConfig): string {
  let path = websiteConfig(kSitePath, project) as string | undefined;
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
  const repoUrl = websiteConfig(kSiteRepoUrl, project) as string | undefined;
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
  return websiteConfig(kSiteRepoBranch, project) as string | undefined ||
    "main";
}

export function websiteMetadataFields(): Array<string | RegExp> {
  return [kSite];
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
  return Promise.resolve(config);
}

export function websiteHtmlFormat(project: ProjectContext): Format {
  const projConfig: Metadata = project.config || {};
  const baseFormat = metadataAsFormat(projConfig);
  const format = formatFromMetadata(baseFormat, formatKeys(projConfig)[0]);
  return mergeConfigs(baseFormat, format);
}
