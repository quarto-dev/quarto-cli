/*
 * pandoc-dependencies-resources.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kFormatResources,
  kResources,
  kSupporting,
} from "../../config/constants.ts";
import { copyTo } from "../../core/copy.ts";
import { lines } from "../../core/text.ts";

import { basename, isAbsolute, join, relative } from "path/mod.ts";
import {
  appendDependencies,
  FormatResourceDependency,
} from "./pandoc-dependencies.ts";
import { existsSync } from "fs/exists.ts";

export interface Resource {
  file: string;
}

// Populates the dependency file with format resources
// from typescript.
export async function writeFormatResources(
  inputDir: string,
  dependenciesFile: string,
  formatResources: string | string[] | undefined,
) {
  if (formatResources) {
    const files = Array.isArray(formatResources)
      ? formatResources
      : [formatResources];

    const dependencies: FormatResourceDependency[] = files.map((file) => {
      const absPath = join(inputDir, file);
      if (!existsSync(absPath)) {
        throw new Error(
          `The referenced format resource '${file}' does not exist.`,
        );
      }
      return {
        type: kFormatResources,
        content: { file: absPath },
      };
    });
    await appendDependencies(dependenciesFile, dependencies);
  }
}

// Processes the dependency file to copy
export async function processFormatResources(
  inputDir: string,
  dependenciesFile: string,
) {
  // Read the dependency file
  const resources: string[] = [];
  const supporting: string[] = [];
  const dependencyJsonStream = await Deno.readTextFile(dependenciesFile);
  for (const jsonBlob of lines(dependencyJsonStream)) {
    if (jsonBlob) {
      // Read the dependency and process format resources
      const dependency = JSON.parse(jsonBlob);
      if (dependency.type === kFormatResources) {
        // Copy the file to the input directory
        const formatResource = dependency.content as Resource;
        const targetPath = join(inputDir, basename(formatResource.file));
        copyTo(
          formatResource.file,
          targetPath,
          {
            overwrite: true,
            preserveTimestamps: true,
          },
        );

        // Mark the file as readonly, if we can
        if (Deno.build.os !== "windows" && Deno.statSync(targetPath).isFile) {
          Deno.chmodSync(targetPath, 0o555);
        }
      } else if (dependency.type === kResources) {
        const resource = dependency.content as Resource;
        resources.push(
          isAbsolute(resource.file)
            ? relative(inputDir, resource.file)
            : resource.file,
        );
      } else if (dependency.type === kSupporting) {
        const supportingResource = dependency.content as Resource;
        supporting.push(supportingResource.file);
      }
    }
  }
  return { supporting, resources };
}
