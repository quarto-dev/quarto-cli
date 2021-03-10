/*
* project-context.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { pathWithForwardSlashes } from "../core/path.ts";

import { includedMetadata, Metadata } from "../config/metadata.ts";
import { kMetadataFile, kMetadataFiles } from "../config/constants.ts";
import { Format, FormatExtras } from "../config/format.ts";
import { PandocFlags } from "../config/flags.ts";

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
    input: string,
    flags: PandocFlags,
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
        const project = projectConfig.project as ProjectMetadata;
        const type = projectType(project.type);
        if (project[kLibDir] === undefined && type.libDir) {
          project[kLibDir] = type.libDir;
        }
        if (!project[kOutputDir] && type.outputDir) {
          project[kOutputDir] = type.outputDir;
        }
        return {
          dir,
          metadata: {
            ...projectConfig,
            project,
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

export function projectOffset(context: ProjectContext, input: string) {
  const projDir = Deno.realPathSync(context.dir);
  const inputDir = Deno.realPathSync(dirname(input));
  const offset = relative(inputDir, projDir) || ".";
  return pathWithForwardSlashes(offset);
}
