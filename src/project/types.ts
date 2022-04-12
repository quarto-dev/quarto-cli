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
import {
  findOpenPort,
  isPortAvailableSync,
  kLocalhost,
  waitForPort,
} from "../core/port.ts";
import { TempContext } from "../core/temp.ts";
import { sleep } from "../core/wait.ts";

export const kProjectType = "type";
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
