/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { RenderServices } from "../command/render/types.ts";
import { Metadata, PandocFlags } from "../config/types.ts";
import { Format, FormatExtras } from "../config/types.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import { NotebookContext } from "../render/notebook/notebook-types.ts";
import {
  NavigationItem as NavItem,
  NavigationItemObject,
  NavigationItemObject as SidebarTool,
  ProjectConfig as ProjectConfig_Project,
} from "../resources/types/schema-types.ts";
import { ProjectEnvironment } from "./project-environment-types.ts";
export {
  type NavigationItem as NavItem,
  type NavigationItemObject,
  type NavigationItemObject as SidebarTool,
  type PageFooter as NavigationFooter,
  type ProjectPreview,
} from "../resources/types/schema-types.ts";

export const kProjectType = "type";
export const kProjectTitle = "title";
export const kProjectRender = "render";
export const kProjectPreRender = "pre-render";
export const kProjectPostRender = "post-render";
export const kProjectExecuteDir = "execute-dir";
export const kProjectOutputDir = "output-dir";
export const kProjectLibDir = "lib-dir";
export const kProjectResources = "resources";

export const kProjectWatchInputs = "watch-inputs";

export interface ProjectContext {
  dir: string;
  engines: string[];
  files: ProjectFiles;
  config?: ProjectConfig;
  formatExtras?: (
    project: ProjectContext,
    source: string,
    flags: PandocFlags,
    format: Format,
    services: RenderServices,
  ) => Promise<FormatExtras>;

  renderFormats: (
    file: string,
    services: RenderServices,
    to?: string,
    project?: ProjectContext,
  ) => Promise<Record<string, Format>>;

  notebookContext: NotebookContext;

  outputNameIndex?: Map<string, { file: string; format: Format } | undefined>;
  environment: (project: ProjectContext) => Promise<ProjectEnvironment>;
}

export interface ProjectFiles {
  input: string[];
  resources?: string[];
  config?: string[];
  configResources?: string[];
}

export interface ProjectConfig {
  project: ProjectConfig_Project;
  [key: string]: unknown;
}

export const kProject404File = "404.html";

export type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

export const kAriaLabel = "aria-label";
export const kCollapseLevel = "collapse-level";
export const kCollapseBelow = "collapse-below";
export const kLogoAlt = "logo-alt";
export const kLogoHref = "logo-href";

export const kSidebarMenus = "sidebar-menus";

export interface Navbar {
  title?: string | false;
  logo?: string;
  [kLogoAlt]?: string;
  [kLogoHref]?: string;
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
  left?: NavItem[];
  right?: NavItem[];
  collapse?: boolean;
  tools?: SidebarTool[];
  pinned?: boolean;
  [kCollapseBelow]?: LayoutBreak;
  [kSidebarMenus]?: boolean;
  darkToggle?: boolean;
  readerToggle?: boolean;
}

/* export interface NavItem {
  // href + more readable/understndable aliases
  icon?: string;
  href?: string;
  file?: string;
  text?: string;
  url?: string;
  [kAriaLabel]?: string;

  // core identification
  id?: string;

  // more
  menu?: NavItem[];
}
 */

export interface Sidebar {
  id?: string;
  title?: string;
  subtitle?: string;
  logo?: string;
  alignment?: "left" | "right" | "center";
  align?: "left" | "right" | "center"; // This is here only because older versions of Quarto used to use it even though it wasn't documented
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

export type SidebarItem = NavigationItemObject & {
  // core structure/contents
  section?: string;
  sectionId?: string;
  contents?: SidebarItem[];

  // more
  expanded?: boolean;
  active?: boolean;

  // transient properties used for expanding 'auto'
  auto?: boolean | string | string[];
};

export interface InputTargetIndex extends Metadata {
  title?: string;
  markdown: PartitionedMarkdown;
  formats: Record<string, Format>;
  draft?: boolean;
}

export interface InputTarget {
  input: string;
  title?: string;
  outputHref: string;
  draft: boolean;
}

/*export interface SidebarTool {
  // label/contents
  icon?: string;
  text?: string;
  menu?: NavItem[];

  // href + more readable/understndable aliases
  href?: string;
  file?: string;
  url?: string;
}*/
