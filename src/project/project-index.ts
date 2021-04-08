/*
* project-index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { exists, existsSync } from "fs/mod.ts";
import { fileExecutionEngine } from "../execute/engine.ts";

import { dirAndStem, pathWithForwardSlashes } from "../core/path.ts";

import { Metadata } from "../config/metadata.ts";
import { Format } from "../config/format.ts";

import { kOutputFile, kTitle } from "../config/constants.ts";

import { renderFormats } from "../command/render/render.ts";

import {
  kOutputDir,
  projectConfigFile,
  ProjectContext,
  projectOutputDir,
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

  // check if this can be handled by one of our engines
  if (fileExecutionEngine(inputFile, true) === undefined) {
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
  const formats = await renderFormats(inputFile, "all", project);
  const index = { formats };
  Deno.writeTextFileSync(indexFile, JSON.stringify(index));
  return index;
}

export async function resolveInputTarget(
  project: ProjectContext,
  href: string,
) {
  const index = await inputTargetIndex(project, href);
  if (index) {
    const format = Object.values(index.formats)[0];
    const [hrefDir, hrefStem] = dirAndStem(href);
    const outputFile = format?.pandoc[kOutputFile] || `${hrefStem}.html`;
    const outputHref = pathWithForwardSlashes("/" + join(hrefDir, outputFile));
    const title = format.metadata?.[kTitle] as string ||
      ((hrefDir === "." && hrefStem === "index")
        ? project.metadata?.project?.title
        : undefined);
    return { title, outputHref };
  } else {
    return undefined;
  }
}

export async function inputFileForOutputFile(
  project: ProjectContext,
  output: string,
) {
  // compute output dir
  const outputDir = projectOutputDir(project);

  // full path to output (it's relative to output dir)
  output = join(outputDir, output);

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
          return output === formatOutputPath;
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
  return projectScratchPath(project.dir, join("index", path));
}
