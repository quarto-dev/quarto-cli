/*
* website-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { kMetadataFormat } from "../../../config/constants.ts";
import { isHtmlOutput } from "../../../config/format.ts";

import { ProjectConfig } from "../../project-context.ts";

export const kSite = "site";

export const kSiteTitle = "title";
export const kSiteUrl = "site-url";
export const kSiteRepoUrl = "repo-url";

export const kSiteNavbar = "navbar";
export const kSiteSidebar = "sidebar";
export const kSitePageNavigation = "page-navigation";
export const kSiteFooter = "footer";

export const kContents = "contents";

export interface WebsiteConfig {
  [kSiteTitle]?: string;
  [kSiteUrl]?: string;
  [kSiteRepoUrl]?: string;
  [kSiteNavbar]?: string;
  [kSiteSidebar]?: string;
  [kSitePageNavigation]?: boolean;
  [kSiteFooter]?: string;
}

export function websiteConfig(
  name:
    | "title"
    | "site-url"
    | "repo-url"
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

export function websiteRepourl(project?: ProjectConfig): string | undefined {
  return websiteConfig(kSiteRepoUrl, project) as string | undefined;
}

export function websiteMetadataFields(): Array<string | RegExp> {
  return [kSite];
}

// provide a project context that elevates html to the default
// format for documents (unless they explicitly declare another format)
export function websiteProjectConfig(
  _projectDir: string,
  config: ProjectConfig,
): Promise<ProjectConfig> {
  config = ld.cloneDeep(config);
  const format = config[kMetadataFormat] as
    | string
    | Record<string, unknown>
    | undefined;
  if (format !== undefined) {
    if (typeof (format) === "string") {
      if (isHtmlOutput(format, true)) {
        return Promise.resolve(config);
      } else {
        config[kMetadataFormat] = {
          html: "default",
          [format]: "default",
        };
      }
    } else {
      const formats = Object.keys(format);
      const orderedFormats = {} as Record<string, unknown>;
      const htmlFormatPos = formats.findIndex((format) =>
        isHtmlOutput(format, true)
      );
      if (htmlFormatPos !== -1) {
        const htmlFormatName = formats.splice(htmlFormatPos, 1)[0];
        orderedFormats[htmlFormatName] = format[htmlFormatName];
      } else {
        orderedFormats["html"] = "default";
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
