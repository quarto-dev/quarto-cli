/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";
import { existsSync } from "fs/mod.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { message } from "../core/console.ts";
import { includedMetadata, Metadata } from "./metadata.ts";
import { kMetadataFile, kMetadataFiles } from "./constants.ts";

export const kExecuteDir = "execute-dir";
export const kOutputDir = "output-dir";
export const kResourceFiles = "resource-files";

export interface ProjectContext {
  dir: string;
  metadata?: {
    project?: ProjectMetadata;
    [key: string]: unknown;
  };
}

export interface ProjectMetadata extends Metadata {
  name?: string;
  type?: string;
  render?: string[];
  [kExecuteDir]?: "file" | "project";
  [kOutputDir]?: string;
  [kResourceFiles]?: [];
}

export function projectConfigDir(dir: string) {
  return join(dir, "_quarto");
}

export function projectContext(path: string): ProjectContext {
  let dir = Deno.statSync(path).isDirectory ? path : dirname(path);
  const originalDir = dir;
  while (true) {
    const configDir = projectConfigDir(dir);
    if (existsSync(configDir)) {
      let projectConfig: Metadata = readQuartoYaml(configDir);
      const includeMetadata = includedMetadata(projectConfig);
      projectConfig = mergeConfigs(projectConfig, includeMetadata);
      delete projectConfig[kMetadataFile];
      delete projectConfig[kMetadataFiles];
      if (projectConfig.project) {
        return {
          dir,
          metadata: projectConfig,
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

export function readQuartoYaml(directory: string) {
  // Reads all the metadata files from the directory
  // and merges them in the order in which they are read

  let yamlPath: string | undefined = undefined;
  try {
    // Read the metadata files from the directory
    const yamls = [];
    for (const walk of expandGlobSync("*.{yml,yaml}", { root: directory })) {
      // Read the metadata for this file
      yamlPath = walk.path;
      yamls.push(readYaml(yamlPath) as Metadata);
    }
    // Return the merged metadata
    return mergeConfigs({}, ...yamls);
  } catch (e) {
    message("\nError reading quarto configuration at " + yamlPath + "\n");
    throw e;
  }
}
