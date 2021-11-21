/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PandocFlags } from "../config/types.ts";
import { Format, FormatExtras } from "../config/types.ts";

export const kProjectType = "type";
export const kProjectRender = "render";
export const kProjectExecuteDir = "execute-dir";
export const kProjectOutputDir = "output-dir";
export const kProjectLibDir = "lib-dir";
export const kProjectResources = "resources";

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
  ) => Promise<FormatExtras>;
}

export interface ProjectConfig {
  project: {
    [kProjectType]?: string;
    [kProjectRender]?: string[];
    [kProjectExecuteDir]?: "file" | "project";
    [kProjectOutputDir]?: string;
    [kProjectLibDir]?: string;
    [kProjectResources]?: string[];
  };
  [key: string]: unknown;
}

export const kProject404File = "404.html";
