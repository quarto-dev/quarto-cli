/*
* project-index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { exists } from "fs/mod.ts";
import { executionEngine } from "../execute/engine.ts";

import { ProjectContext } from "./project-context.ts";

import { projectScratchPath } from "./project-scratch.ts";

export async function inputTargetIndex(
  project: ProjectContext,
  input: string,
): Promise<Record<string, unknown> | undefined> {
  // see if we have an up to date index file
  const inputFile = join(project.dir, input);
  const indexFile = inputTargetIndexFile(project, input);
  if (await exists(indexFile)) {
    const inputMod = (await Deno.stat(inputFile)).mtime;
    const indexMod = (await Deno.stat(indexFile)).mtime;
    if (inputMod && indexMod && (indexMod >= inputMod)) {
      return JSON.parse(Deno.readTextFileSync(indexFile));
    }
  }

  // otherwise read the metadata and index it
  const engine = executionEngine(inputFile);
  if (engine) {
    const metadata = await engine.metadata(inputFile);
    const index = { metadata };
    Deno.writeTextFileSync(indexFile, JSON.stringify(index));
    return index;
  } else {
    return undefined;
  }
}

function inputTargetIndexFile(project: ProjectContext, input: string): string {
  return indexPath(project, `${input}.json`);
}

function indexPath(project: ProjectContext, path = ""): string {
  return projectScratchPath(project, join("idx", path));
}
