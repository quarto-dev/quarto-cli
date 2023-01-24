/*
* project-shared.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { kHtmlMathMethod } from "../config/constants.ts";
import { Format } from "../config/types.ts";

import { normalizePath, pathWithForwardSlashes } from "../core/path.ts";
import { kProjectOutputDir, ProjectContext } from "./types.ts";
import { ProjectType } from "./types/types.ts";

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
  if (existsSync(outputDir)) {
    return normalizePath(outputDir);
  } else {
    return outputDir;
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
    .find(existsSync);
}

export function projectVarsFile(dir: string): string | undefined {
  return ["_variables.yml", "_variables.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
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
          inner(value as any);
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
