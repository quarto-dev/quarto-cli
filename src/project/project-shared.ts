/*
 * project-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/exists.ts";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  SEP_PATTERN,
} from "../deno_ral/path.ts";
import { kHtmlMathMethod } from "../config/constants.ts";
import { Format, Metadata } from "../config/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { getFrontMatterSchema } from "../core/lib/yaml-schema/front-matter.ts";

import { normalizePath, pathWithForwardSlashes } from "../core/path.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import {
  FileInformation,
  kProjectOutputDir,
  kProjectType,
  ProjectConfig,
  ProjectContext,
} from "./types.ts";
import { projectType } from "./types/project-types.ts";
import { ProjectType } from "./types/types.ts";
import { kWebsite } from "./types/website/website-constants.ts";
import { existsSync1 } from "../core/file.ts";
import { kManuscriptType } from "./types/manuscript/manuscript-types.ts";
import { expandIncludes } from "../core/handlers/base.ts";
import { asMappedString, MappedString } from "../core/mapped-text.ts";
import { createTempContext } from "../core/temp.ts";
import { RenderContext, RenderFlags } from "../command/render/types.ts";
import { LanguageCellHandlerOptions } from "../core/handlers/types.ts";

export function projectExcludeDirs(context: ProjectContext): string[] {
  const outputDir = projectOutputDir(context);
  if (outputDir) {
    return [outputDir];
  } else {
    return [];
  }
}

export function projectFormatOutputDir(
  format: Format,
  context: ProjectContext,
  type: ProjectType,
) {
  const projOutputDir = projectOutputDir(context);
  if (type.formatOutputDirectory) {
    const formatOutputDir = type.formatOutputDirectory(format);
    if (formatOutputDir) {
      return join(projOutputDir, formatOutputDir);
    } else {
      return projOutputDir;
    }
  } else {
    return projOutputDir;
  }
}

export function projectOutputDir(context: ProjectContext): string {
  let outputDir = context.config?.project[kProjectOutputDir];
  if (outputDir) {
    outputDir = join(context.dir, outputDir);
  } else {
    outputDir = context.dir;
  }
  if (existsSync(outputDir!)) {
    return normalizePath(outputDir!);
  } else {
    return outputDir!;
  }
}

export function hasProjectOutputDir(context: ProjectContext): boolean {
  return !!context.config?.project[kProjectOutputDir];
}

export function isProjectInputFile(path: string, context: ProjectContext) {
  if (existsSync(path)) {
    const renderPath = normalizePath(path);
    return context.files.input.map((file) => normalizePath(file)).includes(
      renderPath,
    );
  } else {
    return false;
  }
}

export function projectConfigFile(dir: string): string | undefined {
  return ["_quarto.yml", "_quarto.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync1);
}

export function projectVarsFile(dir: string): string | undefined {
  return ["_variables.yml", "_variables.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync1);
}

export function projectOffset(context: ProjectContext, input: string) {
  const projDir = normalizePath(context.dir);
  const inputDir = normalizePath(dirname(input));
  const offset = relative(inputDir, projDir) || ".";
  return pathWithForwardSlashes(offset);
}

export function toInputRelativePaths(
  type: ProjectType,
  baseDir: string,
  inputDir: string,
  collection: Array<unknown> | Record<string, unknown>,
  ignoreResources?: string[],
) {
  const existsCache = new Map<string, string>();
  const resourceIgnoreFields = ignoreResources ||
    ignoreFieldsForProjectType(type) || [];
  const offset = relative(inputDir, baseDir);

  const fixup = (value: string) => {
    // if this is a valid file, then transform it to be relative to the input path
    if (!existsCache.has(value)) {
      const projectPath = join(baseDir, value);
      try {
        if (existsSync(projectPath)) {
          existsCache.set(
            value,
            pathWithForwardSlashes(join(offset!, value)),
          );
        } else {
          existsCache.set(value, value);
        }
      } catch {
        existsCache.set(value, value);
      }
    }
    return existsCache.get(value);
  };

  const inner = (
    collection: Array<unknown> | Record<string, unknown>,
    parentKey?: unknown,
  ) => {
    if (Array.isArray(collection)) {
      for (let index = 0; index < collection.length; ++index) {
        const value = collection[index];
        if (Array.isArray(value) || value instanceof Object) {
          inner(value as Array<unknown>);
        } else if (typeof value === "string") {
          if (value.length > 0 && !isAbsolute(value)) {
            collection[index] = fixup(value);
          }
        }
      }
    } else {
      for (const index of Object.keys(collection)) {
        const value = collection[index];
        if (
          (parentKey === kHtmlMathMethod && index === "method") ||
          resourceIgnoreFields!.includes(index)
        ) {
          // don't fixup html-math-method
        } else if (Array.isArray(value) || value instanceof Object) {
          // deno-lint-ignore no-explicit-any
          inner(value as any, index);
        } else if (typeof value === "string") {
          if (value.length > 0 && !isAbsolute(value)) {
            collection[index] = fixup(value);
          }
        }
      }
    }
  };

  inner(collection);
  return collection;
}

export function ignoreFieldsForProjectType(type?: ProjectType) {
  const resourceIgnoreFields = type
    ? ["project"].concat(
      type.resourceIgnoreFields ? type.resourceIgnoreFields() : [],
    )
    : [] as string[];
  return resourceIgnoreFields;
}

export function projectIsWebsite(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projectTypeIsWebsite(projType);
  } else {
    return false;
  }
}

export function projectIsManuscript(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === kManuscriptType;
  } else {
    return false;
  }
}

export function projectPreviewServe(context?: ProjectContext) {
  return context?.config?.project?.preview?.serve;
}

export function projectIsServeable(context?: ProjectContext): boolean {
  return projectIsWebsite(context) || projectIsManuscript(context) ||
    !!projectPreviewServe(context);
}

export function projectTypeIsWebsite(projType: ProjectType): boolean {
  return projType.type === kWebsite || projType.inheritsType === kWebsite;
}

export function projectIsBook(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === "book";
  } else {
    return false;
  }
}

export function deleteProjectMetadata(metadata: Metadata) {
  // see if the active project type wants to filter the config printed
  const projType = projectType(
    (metadata as ProjectConfig).project?.[kProjectType],
  );
  if (projType.metadataFields) {
    for (const field of projType.metadataFields().concat("project")) {
      if (typeof field === "string") {
        delete metadata[field];
      } else {
        for (const key of Object.keys(metadata)) {
          if (field.test(key)) {
            delete metadata[key];
          }
        }
      }
    }
  }

  // remove project config
  delete metadata.project;
}

export function normalizeFormatYaml(yamlFormat: unknown) {
  if (yamlFormat) {
    if (typeof yamlFormat === "string") {
      yamlFormat = {
        [yamlFormat]: {},
      };
    } else if (typeof yamlFormat === "object") {
      const formats = Object.keys(yamlFormat);
      for (const format of formats) {
        if (
          (yamlFormat as Record<string, unknown>)[format] === "default"
        ) {
          (yamlFormat as Record<string, unknown>)[format] = {};
        }
      }
    }
  }
  return (yamlFormat || {}) as Record<string, unknown>;
}
export async function directoryMetadataForInputFile(
  project: ProjectContext,
  inputDir: string,
) {
  const projectDir = project.dir;
  // Finds a metadata file in a directory
  const metadataFile = (dir: string) => {
    return ["_metadata.yml", "_metadata.yaml"]
      .map((file) => join(dir, file))
      .find(existsSync1);
  };

  // The path from the project dir to the input dir
  const relativePath = relative(projectDir, inputDir);
  const dirs = relativePath.split(SEP_PATTERN);

  // The config we'll ultimately return
  let config = {};

  // Walk through each directory (starting from the project and
  // walking deeper to the input)
  let currentDir = projectDir;
  const frontMatterSchema = await getFrontMatterSchema();
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    currentDir = join(currentDir, dir);
    const file = metadataFile(currentDir);
    if (file) {
      // There is a metadata file, read it and merge it
      // Note that we need to convert paths that are relative
      // to the metadata file to be relative to input
      const errMsg = "Directory metadata validation failed for " + file + ".";
      const yaml = ((await readAndValidateYamlFromFile(
        file,
        frontMatterSchema,
        errMsg,
      )) || {}) as Record<string, unknown>;

      // resolve format into expected structure
      if (yaml.format) {
        yaml.format = normalizeFormatYaml(yaml.format);
      }

      config = mergeConfigs(
        config,
        toInputRelativePaths(
          projectType(project?.config?.project?.[kProjectType]),
          currentDir,
          inputDir,
          yaml as Record<string, unknown>,
        ),
      );
    }
  }

  return config;
}

export async function projectResolveFullMarkdownForFile(
  project: ProjectContext,
  file: string,
  markdown?: MappedString,
  force?: boolean,
): Promise<MappedString> {
  const cache = ensureFileInformationCache(project, file);
  if (!force && cache.fullMarkdown) {
    return cache.fullMarkdown;
  }

  const temp = createTempContext();

  if (!markdown) {
    const inputPath = isAbsolute(file) ? file : join(Deno.cwd(), file);
    if (!existsSync(inputPath)) {
      throw new Error("File does not exist: " + inputPath);
    }
    markdown = asMappedString(Deno.readTextFileSync(inputPath), inputPath);
  }

  const options: LanguageCellHandlerOptions = {
    name: "",
    temp,
    stage: "pre-engine",
    format: undefined as unknown as Format,
    markdown,
    context: {
      project,
      target: {
        source: file,
      },
    } as unknown as RenderContext,
    flags: {} as RenderFlags,
  };
  try {
    const result = await expandIncludes(markdown, options);
    cache.fullMarkdown = result;
    cache.includeMap = options.state?.include as Record<string, string>;
    return result;
  } finally {
    temp.cleanup();
  }
}

const ensureFileInformationCache = (project: ProjectContext, file: string) => {
  if (!project.fileInformationCache) {
    project.fileInformationCache = new Map();
  }
  if (!project.fileInformationCache.has(file)) {
    project.fileInformationCache.set(file, {} as FileInformation);
  }
  return project.fileInformationCache.get(file)!;
};
