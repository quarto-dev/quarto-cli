/*
* project-context.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { includedMetadata, Metadata } from "../config/metadata.ts";
import { kMetadataFile, kMetadataFiles } from "../config/constants.ts";
import { Format, FormatExtras } from "../config/format.ts";

import { projectType } from "./types/project-types.ts";

export const kExecuteDir = "execute-dir";
export const kOutputDir = "output-dir";
export const kLibDir = "lib-dir";
export const kResources = "resources";

export interface ProjectContext {
  dir: string;
  metadata?: {
    project?: ProjectMetadata;
    [key: string]: unknown;
  };
  formatExtras?: (
    project: ProjectContext,
    format: Format,
  ) => FormatExtras;
}

export interface ProjectMetadata extends Metadata {
  type?: string;
  title?: string;
  render?: string[];
  [kExecuteDir]?: "file" | "project";
  [kOutputDir]?: string;
  [kLibDir]?: string;
  [kResources]?: string[];
}

export function projectConfigFile(dir: string): string | undefined {
  return ["_quarto.yml", "_quarto.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
}

export function projectContext(path: string): ProjectContext {
  let dir = Deno.realPathSync(
    Deno.statSync(path).isDirectory ? path : dirname(path),
  );
  const originalDir = dir;

  while (true) {
    const configFile = projectConfigFile(dir);
    if (configFile) {
      let projectConfig: Metadata = readYaml(configFile) as Metadata;
      const includeMetadata = includedMetadata(dir, projectConfig);
      projectConfig = mergeConfigs(projectConfig, includeMetadata);
      delete projectConfig[kMetadataFile];
      delete projectConfig[kMetadataFiles];
      if (projectConfig.project) {
        const config = projectConfig.project as ProjectMetadata;
        const type = projectType(config.type);
        return {
          dir,
          metadata: {
            ...projectConfig,
            project: type.config(config),
          },
          formatExtras: type.formatExtras,
        };
      } else {
        return {
          dir,
        };
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {
          dir: originalDir,
        };
      } else {
        dir = nextDir;
      }
    }
  }
}
