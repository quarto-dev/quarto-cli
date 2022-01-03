/*
* serve-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, join } from "path/mod.ts";

import { copyFileIfNewer, copyMinimal, kSkipHidden } from "../../core/path.ts";
import { createSessionTempDir } from "../../core/temp.ts";

import { kProjectLibDir, ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectFreezerDir } from "../../command/render/freeze.ts";
import { projectCrossrefDir } from "../../project/project-crossrefs.ts";
import { engineIgnoreDirs } from "../../execute/engine.ts";

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

  const ignoreDirs = engineIgnoreDirs();

  const filter = (path: string) => {
    if (
      !copyOutput &&
      (path.startsWith(outputDir) || (libDir && path.startsWith(libDir)))
    ) {
      return false;
    }
    const name = basename(path);
    return !ignoreDirs.includes(name) && !name.startsWith(".");
  };

  // copy source files -- apply filter at top level so that we skip
  // potentially expensive top level dirs (like renv/venv) entirely
  for (const entry of Deno.readDirSync(project.dir)) {
    const srcPath = join(project.dir, entry.name);
    if (filter(srcPath)) {
      const destPath = join(serveDir!, entry.name);
      if (entry.isDirectory) {
        copyMinimal(
          srcPath,
          destPath,
          [kSkipHidden],
          filter,
        );
      } else {
        copyFileIfNewer(srcPath, destPath);
      }
    }
  }

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
