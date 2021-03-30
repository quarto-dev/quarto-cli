/*
* project-context.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { pathWithForwardSlashes } from "../core/path.ts";

import { includedMetadata, Metadata } from "../config/metadata.ts";
import { kMetadataFile, kMetadataFiles } from "../config/constants.ts";
import { Format, FormatExtras } from "../config/format.ts";
import { PandocFlags } from "../config/flags.ts";

import { ProjectType, projectType } from "./types/project-types.ts";

import { resolvePathGlobs } from "../core/path.ts";

import { fileExecutionEngine } from "../execute/engine.ts";
import { projectResourceFiles } from "./project-resources.ts";

export const kExecuteDir = "execute-dir";
export const kOutputDir = "output-dir";
export const kLibDir = "lib-dir";
export const kResources = "resources";

export interface ProjectContext {
  dir: string;
  files: {
    input: string[];
    resources?: string[];
    config?: string[];
    configResources?: string[];
  };
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
      const { metadata, files } = includedMetadata(dir, projectConfig);
      projectConfig = mergeConfigs(projectConfig, metadata);
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
        // TODO: configResources needs exclude list
        // (input files, output files, project resources)
        return {
          dir,
          files: {
            input: projectInputFiles(dir, project),
            resources: projectResourceFiles(dir, project),
            config: [configFile].concat(files),
            configResources: projectConfigResources(dir, type, projectConfig),
          },
          metadata: {
            ...projectConfig,
            project,
          },
          formatExtras: type.formatExtras,
        };
      } else {
        return {
          dir,
          files: {
            input: projectInputFiles(dir),
          },
        };
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {
          dir: originalDir,
          files: {
            input: projectInputFiles(dir),
          },
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

export function projectMetadataForInputFile(
  input: string,
  project?: ProjectContext,
): Metadata {
  project = project || projectContext(input);

  const projMetadata = project.metadata || {};

  const fixupPaths = (collection: Array<unknown> | Record<string, unknown>) => {
    ld.forEach(
      collection,
      (
        value: unknown,
        index: unknown,
        collection: Array<unknown> | Record<string, unknown>,
      ) => {
        const assign = (value: unknown) => {
          if (typeof (index) === "number") {
            (collection as Array<unknown>)[index] = value;
          } else if (typeof (index) === "string") {
            (collection as Record<string, unknown>)[index] = value;
          }
        };

        if (Array.isArray(value)) {
          assign(fixupPaths(value));
        } else if (typeof (value) === "object") {
          assign(fixupPaths(value as Record<string, unknown>));
        } else if (typeof (value) === "string") {
          if (!isAbsolute(value)) {
            // if this is a valid file, then transform it to be relative to the input path
            const projectPath = join(project!.dir, value);

            // Paths could be invalid paths (e.g. with colons or other weird characters)
            try {
              if (existsSync(projectPath)) {
                const offset = relative(dirname(input), project!.dir);
                assign(join(offset, value));
              }
            } catch (e) {
              // Just ignore this error as the path must not be a local file path
            }
          }
        }
      },
    );
    return collection;
  };

  return fixupPaths(projMetadata) as Metadata;
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

function projectConfigResources(
  dir: string,
  type: ProjectType,
  metadata: Metadata,
) {
  const resourceIgnoreFields = ["project"].concat(
    type.resourceIgnoreFields ? type.resourceIgnoreFields() : [],
  );
  const resources: string[] = [];
  const findResources = (
    collection: Array<unknown> | Record<string, unknown>,
  ) => {
    ld.forEach(
      collection,
      (value: unknown, index: unknown) => {
        if (resourceIgnoreFields.includes(index as string)) {
          // project type specific ignore (e.g. nav-top, nav-side)
        } else if (Array.isArray(value)) {
          findResources(value);
        } else if (typeof (value) === "object") {
          findResources(value as Record<string, unknown>);
        } else if (typeof (value) === "string") {
          const path = isAbsolute(value) ? value : join(dir, value);
          // Paths could be invalid paths (e.g. with colons or other weird characters)
          try {
            if (existsSync(path) && !Deno.statSync(path).isDirectory) {
              resources.push(Deno.realPathSync(path));
            }
          } catch (e) {
            // Just ignore this error as the path must not be a local file path
          }
        }
      },
    );
  };

  findResources(metadata);
  return resources;
}
