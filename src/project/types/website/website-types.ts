/*
* website-types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  OpenGraphConfig,
  SocialMetadata,
  TwitterCardConfig,
} from "../../../resources/types/schema-types.ts";

import {
  kLocale,
  kOpenGraph,
  kPageFooter,
  kSiteFavicon,
  kSiteName,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteRepoActions,
  kSiteRepoBranch,
  kSiteRepoUrl,
  kSiteSidebar,
  kSiteTitle,
  kSiteUrl,
  kTwitterCard,
} from "./website-constants.ts";

export interface WebsiteConfig {
  [kSiteTitle]?: string;
  [kSiteFavicon]?: string;
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
