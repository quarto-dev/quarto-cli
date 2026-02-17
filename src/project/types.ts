/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { RenderServices } from "../command/render/types.ts";
import { Metadata, PandocFlags } from "../config/types.ts";
import { Format, FormatExtras } from "../config/types.ts";
import {
  Brand,
  LightDarkBrand,
  LightDarkBrandDarkFlag,
} from "../core/brand/brand.ts";
import { MappedString } from "../core/mapped-text.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import {
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
} from "../execute/types.ts";
import { InspectedMdCell } from "../inspect/inspect-types.ts";
import { NotebookContext } from "../render/notebook/notebook-types.ts";
import {
  LogoLightDarkSpecifier,
  NavigationItem as NavItem,
  NavigationItemObject,
  NavigationItemObject as SidebarTool,
  ProjectConfig as ProjectConfig_Project,
} from "../resources/types/schema-types.ts";
import { ProjectEnvironment } from "./project-environment-types.ts";
import { ProjectCache } from "../core/cache/cache-types.ts";
import { TempContext } from "../core/temp-types.ts";
import { Cloneable } from "../core/safe-clone-deep.ts";

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

export type FileInclusion = {
  source: string;
  target: string;
};

export type FileInformation = {
  fullMarkdown?: MappedString;
  includeMap?: FileInclusion[];
  codeCells?: InspectedMdCell[];
  engine?: ExecutionEngineInstance;
  target?: ExecutionTarget;
  metadata?: Metadata;
  brand?: LightDarkBrandDarkFlag;
};

export interface ProjectContext extends Cloneable<ProjectContext> {
  dir: string;
  engines: string[];
  files: ProjectFiles;
  config?: ProjectConfig;
  notebookContext: NotebookContext;
  outputNameIndex?: Map<string, { file: string; format: Format } | undefined>;

  fileInformationCache: Map<string, FileInformation>;

  // This is a cache of _brand.yml for a project
  brandCache?: { brand?: LightDarkBrandDarkFlag };
  resolveBrand: (
    fileName?: string,
  ) => Promise<
    undefined | LightDarkBrandDarkFlag
  >;

  // expands markdown for a file
  // input file doesn't have to be markdown; it can be, for example, a knitr spin file
  // output file is always markdown, though, and it is cached in the project

  resolveFullMarkdownForFile: (
    engine: ExecutionEngineInstance | undefined,
    file: string,
    markdown?: MappedString,
    force?: boolean,
  ) => Promise<MappedString>;

  fileExecutionEngineAndTarget: (
    file: string,
    force?: boolean,
  ) => Promise<{ engine: ExecutionEngineInstance; target: ExecutionTarget }>;

  fileMetadata: (
    file: string,
    force?: boolean,
  ) => Promise<Metadata>;

  formatExtras?: (
    source: string,
    flags: PandocFlags,
    format: Format,
    services: RenderServices,
  ) => Promise<FormatExtras>;

  // declaring renderFormats here is a relatively ugly hack to avoid a circular import chain
  // that causes a deno bundler bug
  renderFormats: (
    file: string,
    services: RenderServices,
    to: string | undefined,
    project: ProjectContext,
  ) => Promise<Record<string, Format>>;

  environment: () => Promise<ProjectEnvironment>;

  isSingleFile: boolean;
  previewServer?: boolean;

  diskCache: ProjectCache;
  temp: TempContext;

  cleanup: () => void;
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

/**
 * A restricted version of ProjectContext that only exposes
 * functionality needed by execution engines.
 */
export interface EngineProjectContext {
  /**
   * Base directory of the project
   */
  dir: string;

  /**
   * Flag indicating if project consists of a single file
   */
  isSingleFile: boolean;

  /**
   * Config object containing project configuration
   * Used primarily for config?.engines access
   * Can contain arbitrary configuration properties
   */
  config?: {
    engines?: string[];
    project?: {
      [kProjectOutputDir]?: string;
    };
    [key: string]: unknown;
  };

  /**
   * For file information cache management
   * Used for the transient notebook tracking in Jupyter
   */
  fileInformationCache: Map<string, FileInformation>;

  /**
   * Get the output directory for the project
   *
   * @returns Path to output directory
   */
  getOutputDirectory: () => string;

  /**
   * Resolves full markdown content for a file, including expanding includes
   *
   * @param engine - The execution engine
   * @param file - Path to the file
   * @param markdown - Optional existing markdown content
   * @param force - Whether to force re-resolution even if cached
   * @returns Promise resolving to mapped markdown string
   */
  resolveFullMarkdownForFile: (
    engine: ExecutionEngineInstance | undefined,
    file: string,
    markdown?: MappedString,
    force?: boolean,
  ) => Promise<MappedString>;
}

export const kAriaLabel = "aria-label";
export const kCollapseLevel = "collapse-level";
export const kCollapseBelow = "collapse-below";
export const kToolsCollapse = "tools-collapse";
export const kLogoAlt = "logo-alt";
export const kLogoHref = "logo-href";

export const kSidebarMenus = "sidebar-menus";

export interface Navbar {
  title?: string | false;
  logo?: LogoLightDarkSpecifier;
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
  [kToolsCollapse]?: boolean;
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
  logo?: LogoLightDarkSpecifier;
  [kLogoAlt]?: string;
  [kLogoHref]?: string;
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
