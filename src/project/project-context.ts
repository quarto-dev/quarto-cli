/*
* project-context.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { pathWithForwardSlashes } from "../core/path.ts";

import { includedMetadata, Metadata } from "../config/metadata.ts";
import { kMetadataFile, kMetadataFiles } from "../config/constants.ts";
import { Format, FormatExtras } from "../config/format.ts";
import { PandocFlags } from "../config/flags.ts";

import { projectType } from "./types/project-types.ts";

import { resolvePathGlobs } from "../core/path.ts";

import { fileExecutionEngine } from "../execute/engine.ts";

export const kExecuteDir = "execute-dir";
export const kOutputDir = "output-dir";
export const kLibDir = "lib-dir";
export const kResources = "resources";

export interface ProjectContext {
  dir: string;
  inputFiles: string[];
  metadata?: {
    project?: ProjectMetadata;
    [key: string]: unknown;
  };
  formatExtras?: (
    project: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
  ) => Promise<FormatExtras>;
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

export function deleteProjectMetadata(metadata: Metadata) {
  // see if the active project type wants to filter the metadata printed
  const projType = projectType((metadata.project as ProjectMetadata)?.type);
  if (projType.metadataFields) {
    for (const field of projType.metadataFields()) {
      delete metadata[field];
    }
  }

  // remove project metadata
  delete metadata.project;
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
          inputFiles: projectInputFiles(dir, project),
          metadata: {
            ...projectConfig,
            project,
          },
          formatExtras: type.formatExtras,
        };
      } else {
        return {
          dir,
          inputFiles: projectInputFiles(dir),
        };
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {
          dir: originalDir,
          inputFiles: projectInputFiles(dir),
        };
      } else {
        dir = nextDir;
      }
    }
  }
}

export function projectOutputDir(context: ProjectContext) {
  let outputDir = context.metadata?.project?.[kOutputDir];
  if (outputDir) {
    outputDir = join(context.dir, outputDir);
  } else {
    outputDir = context.dir;
  }
  return Deno.realPathSync(outputDir);
}

export function projectOffset(context: ProjectContext, input: string) {
  const projDir = Deno.realPathSync(context.dir);
  const inputDir = Deno.realPathSync(dirname(input));
  const offset = relative(inputDir, projDir) || ".";
  return pathWithForwardSlashes(offset);
}

function projectInputFiles(dir: string, metadata?: ProjectMetadata) {
  const files: string[] = [];
  const keepFiles: string[] = [];

  const outputDir = metadata?.[kOutputDir];

  const addFile = (file: string) => {
    if (!outputDir || !file.startsWith(join(dir, outputDir))) {
      const engine = fileExecutionEngine(file);
      if (engine) {
        files.push(file);
        const keep = engine.keepFiles(file);
        if (keep) {
          keepFiles.push(...keep);
        }
      }
    }
  };

  const addDir = (dir: string) => {
    for (
      const walk of walkSync(
        dir,
        { includeDirs: false, followSymlinks: true, skip: [/[/\\][_\.]/] },
      )
    ) {
      addFile(walk.path);
    }
  };

  const renderFiles = metadata?.render;
  if (renderFiles) {
    const exclude = outputDir ? [outputDir] : [];
    const resolved = resolvePathGlobs(dir, renderFiles, exclude);
    (ld.difference(resolved.include, resolved.exclude) as string[])
      .forEach((file) => {
        if (Deno.statSync(file).isDirectory) {
          addDir(file);
        } else {
          addFile(file);
        }
      });
  } else {
    addDir(dir);
  }

  const inputFiles = ld.difference(
    ld.uniq(files),
    ld.uniq(keepFiles),
  ) as string[];
  return inputFiles;
}
