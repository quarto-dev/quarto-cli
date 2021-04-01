/*
* project-index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { exists, existsSync } from "fs/mod.ts";
import { fileExecutionEngine } from "../execute/engine.ts";

import { Metadata } from "../config/metadata.ts";
import { Format } from "../config/format.ts";

import { kOutputFile } from "../config/constants.ts";

import { renderFormats } from "../command/render/render.ts";

import {
  kOutputDir,
  projectConfigFile,
  ProjectContext,
} from "./project-context.ts";

import { projectScratchPath } from "./project-scratch.ts";

export interface InputTargetIndex extends Metadata {
  formats: Record<string, Format>;
}

export async function inputTargetIndex(
  project: ProjectContext,
  input: string,
): Promise<InputTargetIndex | undefined> {
  // calculate input file
  const inputFile = join(project.dir, input);

  // return undefined if the file doesn't exist
  if (!await exists(inputFile)) {
    return Promise.resolve(undefined);
  }

  // see if we have an up to date index file
  const indexFile = inputTargetIndexFile(project, input);
  if (await exists(indexFile)) {
    const inputMod = (await Deno.stat(inputFile)).mtime;
    const indexMod = (await Deno.stat(indexFile)).mtime;
    const projConfigFile = projectConfigFile(project.dir);
    const projMod = projConfigFile
      ? (await Deno.stat(projConfigFile)).mtime
      : 0;
    if (
      inputMod && indexMod && (indexMod >= inputMod) &&
      (!projMod || (indexMod >= projMod))
    ) {
      return JSON.parse(Deno.readTextFileSync(indexFile));
    }
  }

  // otherwise read the metadata and index it
  const formats = await renderFormats(inputFile);
  const index = { formats };
  Deno.writeTextFileSync(indexFile, JSON.stringify(index));
  return index;
}

export async function inputFileForOutputFile(
  project: ProjectContext,
  output: string,
) {
  // real path to output file
  output = Deno.realPathSync(output);

  // compute output dir
  let outputDir = project.metadata?.project?.[kOutputDir];
  outputDir = outputDir ? join(project.dir, outputDir) : project.dir;

  for (const file of project.files.input) {
    const inputRelative = relative(project.dir, file);
    const index = await inputTargetIndex(project, relative(project.dir, file));
    if (index) {
      const hasOutput = Object.keys(index.formats).some((key) => {
        const format = index.formats[key];
        if (format.pandoc[kOutputFile]) {
          const formatOutputPath = join(
            outputDir!,
            dirname(inputRelative),
            format.pandoc[kOutputFile]!,
          );
          return existsSync(formatOutputPath) &&
            (output === Deno.realPathSync(formatOutputPath));
        }
      });
      if (hasOutput) {
        return file;
      }
    }
  }
}

function inputTargetIndexFile(project: ProjectContext, input: string): string {
  return indexPath(project, `${input}.json`);
}

function indexPath(project: ProjectContext, path = ""): string {
  return projectScratchPath(project, join("index", path));
}
