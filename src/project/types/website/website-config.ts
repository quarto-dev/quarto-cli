/*
* website-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export const kSiteTitle = "site-title";
export const kSiteBaseUrl = "site-base-url";

export const kSiteNavbar = "site-navbar";
export const kSiteSidebar = "site-sidebar";

export const kContents = "contents";

export function websiteMetadataFields(): Array<string | RegExp> {
  return [/^site-.*$/];
}
