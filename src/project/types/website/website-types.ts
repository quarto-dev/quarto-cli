/*
* website-types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { kTitle } from "../../../config/constants.ts";
import { kDescription } from "./listing/website-listing-shared.ts";
import {
  kCardStyle,
  kCreator,
  kImage,
  kImageAlt,
  kImageHeight,
  kImageWidth,
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
  kTwitterSite,
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
  [kImageAlt]?: string;
  [kLocale]?: string;
  [kSiteName]?: string;
}
