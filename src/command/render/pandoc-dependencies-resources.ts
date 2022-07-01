/*
* pandoc-dependencies-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kFormatResources } from "../../config/constants.ts";
import { copyTo } from "../../core/copy.ts";
import { lines } from "../../core/text.ts";

import { basename, join } from "path/mod.ts";

export interface FormatResource {
  file: string;
}

// Populates the dependency file with format resources
// from typescript.
export function writeFormatResources(
  inputDir: string,
  dependenciesFile: string,
  formatResources: string | string[] | undefined,
) {
  if (formatResources) {
    const files = Array.isArray(formatResources)
      ? formatResources
      : [formatResources];

    const dependencyLines: string[] = [];
    for (const file of files) {
      const path = join(inputDir, file);
      // Ensure this is input relative
      dependencyLines.push(
        JSON.stringify({ type: kFormatResources, content: { file: path } }),
      );
    }
    if (dependencyLines.length > 0) {
      Deno.writeTextFileSync(
        dependenciesFile,
        `${dependencyLines.join("\n")}\n`,
      );
    }
  }
}

// Processes the dependency file to copy
export async function processFormatResources(
  inputDir: string,
  dependenciesFile: string,
) {
  // Read the dependency file
  const dependencyJsonStream = await Deno.readTextFile(dependenciesFile);
  for (const jsonBlob of lines(dependencyJsonStream)) {
    if (jsonBlob) {
      // Read the dependency and process format resources
      const dependency = JSON.parse(jsonBlob);
      if (dependency.type === kFormatResources) {
        // Copy the file to the input directory
        const formatResource = dependency.content as FormatResource;
        const targetFile = join(inputDir, basename(formatResource.file));
        copyTo(
          formatResource.file,
          targetFile,
          {
            overwrite: true,
            preserveTimestamps: true,
          },
        );

        // Mark the file as readonly, if we can
        if (Deno.build.os !== "windows") {
          Deno.chmodSync(targetFile, 0o555);
        }
      }
    }
  }
}
