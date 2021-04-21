/*
* website-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectConfig } from "../../project-context.ts";

export const kSite = "site";

export const kSiteTitle = "title";
export const kSiteBaseUrl = "base-url";

export const kSiteNavbar = "navbar";
export const kSiteSidebar = "sidebar";

export const kContents = "contents";

export interface WebsiteConfig {
  [kSiteTitle]?: string;
  [kSiteBaseUrl]?: string;
  [kSiteNavbar]?: string;
  [kSiteSidebar]?: string;
}

export function websiteConfig(
  name: "title" | "base-url" | "navbar" | "sidebar",
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
  return websiteConfig(kSiteBaseUrl, project) as string | undefined;
}

export function websiteMetadataFields(): Array<string | RegExp> {
  return [kSite];
}
