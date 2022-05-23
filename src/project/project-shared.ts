/*
* project-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { kHtmlMathMethod } from "../config/constants.ts";

import { pathWithForwardSlashes } from "../core/path.ts";
import * as ld from "../core/lodash.ts";
import { kProjectOutputDir, ProjectContext } from "./types.ts";
import { ProjectType } from "./types/types.ts";

export function projectOutputDir(context: ProjectContext): string {
  let outputDir = context.config?.project[kProjectOutputDir];
  if (outputDir) {
    outputDir = join(context.dir, outputDir);
  } else {
    outputDir = context.dir;
  }
  if (existsSync(outputDir)) {
    return Deno.realPathSync(outputDir);
  } else {
    return outputDir;
  }
}

export function isProjectInputFile(path: string, context: ProjectContext) {
  if (existsSync(path)) {
    const renderPath = Deno.realPathSync(path);
    return context.files.input.map((file) => Deno.realPathSync(file)).includes(
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

export function projectPublishFile(dir: string): string | undefined {
  return ["_publish.yml", "_publish.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
}

export function projectOffset(context: ProjectContext, input: string) {
  const projDir = Deno.realPathSync(context.dir);
  const inputDir = Deno.realPathSync(dirname(input));
  const offset = relative(inputDir, projDir) || ".";
  return pathWithForwardSlashes(offset);
}

export function toInputRelativePaths(
  type: ProjectType,
  baseDir: string,
  inputDir: string,
  collection: Array<unknown> | Record<string, unknown>,
  parentKey?: unknown,
) {
  const resourceIgnoreFields = ignoreFieldsForProjectType(type);
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

      if (
        resourceIgnoreFields.includes(index as string) ||
        (parentKey === kHtmlMathMethod && index === "method")
      ) {
        // don't fixup html-math-method
      } else if (Array.isArray(value)) {
        assign(toInputRelativePaths(type, baseDir, inputDir, value));
      } else if (typeof (value) === "object") {
        assign(
          toInputRelativePaths(
            type,
            baseDir,
            inputDir,
            value as Record<string, unknown>,
            index,
          ),
        );
      } else if (typeof (value) === "string") {
        if (value.length > 0 && !isAbsolute(value)) {
          // if this is a valid file, then transform it to be relative to the input path
          const projectPath = join(baseDir, value);

          // Paths could be invalid paths (e.g. with colons or other weird characters)
          try {
            if (existsSync(projectPath)) {
              const offset = relative(inputDir, baseDir);
              assign(pathWithForwardSlashes(join(offset, value)));
            }
          } catch {
            // Just ignore this error as the path must not be a local file path
          }
        }
      }
    },
  );
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
