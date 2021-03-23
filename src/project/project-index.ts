/*
* project-index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { exists } from "fs/mod.ts";
import { fileExecutionEngine } from "../execute/engine.ts";

import { Metadata } from "../config/metadata.ts";
import { Format } from "../config/format.ts";

import { renderFormats } from "../command/render/render.ts";

import { projectConfigFile, ProjectContext } from "./project-context.ts";

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

function inputTargetIndexFile(project: ProjectContext, input: string): string {
  return indexPath(project, `${input}.json`);
}

function indexPath(project: ProjectContext, path = ""): string {
  return projectScratchPath(project, join("index", path));
}
