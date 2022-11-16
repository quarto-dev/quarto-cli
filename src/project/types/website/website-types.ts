/*
* website-types.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  OpenGraphConfig,
  TwitterCardConfig,
} from "../../../resources/types/schema-types.ts";

import {
  kOpenGraph,
  kPageFooter,
  kSiteFavicon,
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
