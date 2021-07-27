/*
* serve-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join, relative } from "path/mod.ts";

import {
  copyMinimal,
  kSkipHidden,
  pathWithForwardSlashes,
} from "../../core/path.ts";
import { createSessionTempDir } from "../../core/temp.ts";

import { kProjectLibDir, ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectIgnoreRegexes } from "../../project/project-context.ts";
import { projectFreezerDir } from "../render/freeze.ts";
import { projectCrossrefDir } from "../../project/project-crossrefs.ts";

export function copyProjectForServe(
  project: ProjectContext,
  copyOutput: boolean,
  serveDir?: string,
) {
  serveDir = serveDir || createSessionTempDir();

  // output dir
  const outputDir = projectOutputDir(project);
  // lib dir
  const libDirConfig = project.config?.project[kProjectLibDir];
  const libDir = libDirConfig ? join(project.dir, libDirConfig) : undefined;

  const projectIgnore = projectIgnoreRegexes(project.dir);

  const filter = (path: string) => {
    if (
      !copyOutput &&
      (path.startsWith(outputDir) || (libDir && path.startsWith(libDir)))
    ) {
      return false;
    }
    const pathRelative = pathWithForwardSlashes(relative(project.dir, path));
    return !projectIgnore.some((regex: RegExp) => regex.test(pathRelative));
  };

  // copy source files (skip output if requested)
  copyMinimal(
    project.dir,
    serveDir,
    [kSkipHidden],
    filter,
  );
  // copy freezer
  copyMinimal(
    projectFreezerDir(project.dir, true),
    projectFreezerDir(serveDir, true),
  );
  // copy crossrefs
  copyMinimal(
    projectCrossrefDir(project.dir),
    projectCrossrefDir(serveDir),
  );
  return Deno.realPathSync(serveDir);
}
