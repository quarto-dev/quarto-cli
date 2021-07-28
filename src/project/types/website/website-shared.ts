/*
* website-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { dirAndStem, pathWithForwardSlashes } from "../../../core/path.ts";

import { ProjectContext } from "../../types.ts";
import { Navbar, Sidebar } from "../../project-config.ts";
import {
  kSiteFooter,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteSidebar,
  websiteConfig,
} from "./website-config.ts";
import { cookieConsentEnabled } from "./website-analytics.ts";

export function inputFileHref(href: string) {
  const [hrefDir, hrefStem] = dirAndStem(href);
  const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
  return pathWithForwardSlashes(htmlHref);
}

export function websiteNavigationConfig(project: ProjectContext) {
  // read navbar
  let navbar = websiteConfig(kSiteNavbar, project.config) as Navbar | undefined;
  if (typeof (navbar) !== "object") {
    navbar = undefined;
  }

  // read sidebar
  const sidebar = websiteConfig(kSiteSidebar, project.config);
  const sidebars =
    (Array.isArray(sidebar)
      ? sidebar
      : typeof (sidebar) == "object"
      ? [sidebar]
      : undefined) as Sidebar[] | undefined;

  // if there is more than one sidebar then propagate options from the
  // first sidebar to the others
  if (sidebars && sidebars.length > 1) {
    const sidebarOptions = ld.cloneDeep(sidebars[0]) as Sidebar;
    delete sidebarOptions.id;
    delete sidebarOptions.title;
    sidebarOptions.contents.splice(0, sidebarOptions.contents.length);
    for (let i = 1; i < sidebars.length; i++) {
      sidebars[i] = {
        ...sidebarOptions,
        ...sidebars[i],
      };
    }
  }

  // read the page navigation
  const pageNavigation = !!websiteConfig(kSitePageNavigation, project.config);

  // read any footer
  const footer = websiteConfig(kSiteFooter, project.config) ||
    (cookieConsentEnabled(project) ? "&nbsp;" : undefined);

  // return
  return { navbar, sidebars, pageNavigation, footer };
}
