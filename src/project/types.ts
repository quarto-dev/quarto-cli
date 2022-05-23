/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PandocFlags } from "../config/types.ts";
import { Format, FormatExtras } from "../config/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { isRStudio } from "../core/platform.ts";
import { findOpenPort, kLocalhost, waitForPort } from "../core/port.ts";
import { TempContext } from "../core/temp-types.ts";

export const kProjectType = "type";
export const kProjectRender = "render";
export const kProjectPreRender = "pre-render";
export const kProjectPostRender = "post-render";
export const kProjectExecuteDir = "execute-dir";
export const kProjectOutputDir = "output-dir";
export const kProjectLibDir = "lib-dir";
export const kProjectResources = "resources";

export const kProjectWatchInputs = "watch-inputs";

export const kProjectPublish = "publish";
export const kProjectPublishNetlify = "netlify";

export interface ProjectContext {
  dir: string;
  engines: string[];
  files: {
    input: string[];
    resources?: string[];
    config?: string[];
    configResources?: string[];
  };
  config?: ProjectConfig;
  formatExtras?: (
    project: ProjectContext,
    source: string,
    flags: PandocFlags,
    format: Format,
    temp: TempContext,
  ) => Promise<FormatExtras>;
}

export interface ProjectPublish {
  netlify?: string | string[];
}

export interface ProjectConfig {
  project: {
    [kProjectType]?: string;
    [kProjectRender]?: string[];
    [kProjectPreRender]?: string[];
    [kProjectPostRender]?: string[];
    [kProjectExecuteDir]?: "file" | "project";
    [kProjectOutputDir]?: string;
    [kProjectLibDir]?: string;
    [kProjectResources]?: string[];
    preview?: ProjectPreview;
  };
  publish?: ProjectPublish;
  [key: string]: unknown;
}

export interface ProjectPreview {
  port?: number;
  host?: string;
  browser?: boolean;
  [kProjectWatchInputs]?: boolean;
  navigate?: boolean;
  timeout?: number;
}

export async function resolvePreviewOptions(
  options: ProjectPreview,
  project?: ProjectContext,
): Promise<ProjectPreview> {
  // start with project options if we have them
  if (project?.config?.project.preview) {
    options = mergeConfigs(project.config.project.preview, options);
  }
  // provide defaults
  const resolved = mergeConfigs({
    host: kLocalhost,
    browser: true,
    [kProjectWatchInputs]: !isRStudio(),
    timeout: 0,
    navigate: true,
  }, options) as ProjectPreview;

  // if a specific port is requested then wait for it up to 5 seconds
  if (resolved.port) {
    if (!await waitForPort({ port: resolved.port, hostname: resolved.host })) {
      throw new Error(`Requested port ${options.port} is already in use.`);
    }
  } else {
    resolved.port = findOpenPort();
  }

  return resolved;
}

export const kProject404File = "404.html";

export type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

export const kAriaLabel = "aria-label";
export const kCollapseLevel = "collapse-level";
export const kCollapseBelow = "collapse-below";

export const kSidebarMenus = "sidebar-menus";

export interface Navbar {
  title?: string | false;
  logo?: string;
  background:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark";
  search?: boolean | string;
  left?: NavbarItem[];
  right?: NavbarItem[];
  collapse?: boolean;
  tools?: SidebarTool[];
  pinned?: boolean;
  [kCollapseBelow]?: LayoutBreak;
  [kSidebarMenus]?: boolean;
  darkToggle?: boolean;
  readerToggle?: boolean;
}

export interface NavItem {
  // href + more readable/understndable aliases
  icon?: string;
  href?: string;
  file?: string;
  text?: string;
  url?: string;
  [kAriaLabel]?: string;
}

export interface NavbarItem extends NavItem {
  // core identification
  id?: string;

  // more
  menu?: NavbarItem[];
}

export interface Sidebar {
  id?: string;
  title?: string;
  subtitle?: string;
  logo?: string;
  aligment?: "left" | "right" | "center";
  background?:
    | "none"
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark"
    | "white";
  search?: boolean | string;
  [kCollapseLevel]?: number;
  contents: SidebarItem[];
  tools: SidebarTool[];
  style: "docked" | "floating";
  pinned?: boolean;
  header?: Array<string> | string;
  footer?: Array<string> | string;
}

export interface SidebarItem extends NavItem {
  // core structure/contents
  section?: string;
  sectionId?: string;
  contents?: SidebarItem[];

  // more
  expanded?: boolean;
  active?: boolean;
}

export interface SidebarTool {
  // label/contents
  icon?: string;
  text?: string;
  menu?: NavbarItem[];

  // href + more readable/understndable aliases
  href?: string;
  file?: string;
  url?: string;
}
