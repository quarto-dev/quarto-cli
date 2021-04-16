/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../../core/path.ts";

import { kKeepMd } from "../../config/constants.ts";

import {
  kExecuteDir,
  kLibDir,
  kOutputDir,
  ProjectContext,
} from "../../project/project-context.ts";

import { projectType } from "../../project/types/project-types.ts";
import { copyResourceFile } from "../../project/project-resources.ts";
import { ensureGitignore } from "../../project/project-gitignore.ts";

import {
  formatKeys,
  renderFiles,
  RenderOptions,
  RenderResult,
} from "./render.ts";
import {
  copyToProjectFreezer,
  kProjectFreezeDir,
  pruneProjectFreezer,
  pruneProjectFreezerDir,
} from "./freeze.ts";

export async function renderProject(
  context: ProjectContext,
  options: RenderOptions,
  files?: string[],
): Promise<RenderResult> {
  // is this an incremental render?
  const incremental = !!files;

  // should we be forcing execution? note that when the caller
  // explicitly requests the user of the freezer then we
  // shouldn't force execution (this might happen e.g. for
  // render on navigate for the dev server)
  const alwaysExecute = incremental && !options.useFreezer;

  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

  // default for files if not specified
  files = files || context.files.input;

  // projResults to return
  const projResults: RenderResult = {
    baseDir: projDir,
    outputDir: context.metadata?.project?.[kOutputDir],
    files: [],
  };

  // ensure we have the requisite entries in .gitignore
  await ensureGitignore(context);

  // lookup the project type and call preRender
  const projType = projectType(context.metadata?.project?.type);
  if (projType.preRender) {
    await projType.preRender(context);
  }

  // validate the project formats
  if (projType.outputFormats) {
    const projFormats = formatKeys(context.metadata || {});
    const validFormats = projType.outputFormats(projFormats, []);
    const unsupportedFormats = ld.difference(projFormats, validFormats);
    for (const format of unsupportedFormats) {
      warning(
        `The ${format} format is not supported for ${projType.type} projects.`,
      );
    }
  }

  // set execute dir if requested
  const executeDir = context.metadata?.project?.[kExecuteDir];
  if (options.flags?.executeDir === undefined && executeDir === "project") {
    options = {
      ...options,
      flags: {
        ...options.flags,
        executeDir: projDir,
      },
    };
  }

  // set kernelKeepalive to 0 for renders of the entire project
  // or a list of more than one file (don't want to leave dozens of
  // kernels in memory)
  if (
    files.length > 1 && options.flags &&
    options.flags.kernelKeepalive === undefined
  ) {
    options.flags.kernelKeepalive = 0;
  }

  // determine the output dir
  const outputDir = projResults.outputDir;
  const outputDirAbsolute = outputDir ? join(projDir, outputDir) : undefined;
  if (outputDirAbsolute) {
    ensureDirSync(outputDirAbsolute);
  }

  // track the lib dir
  const libDir = context.metadata?.project?.[kLibDir];

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", projDir);
  try {
    // render the files
    const fileResults = await renderFiles(
      files,
      options,
      projType?.pandocRenderer
        ? projType.pandocRenderer(options, context)
        : undefined,
      context,
      alwaysExecute,
    );

    if (outputDirAbsolute) {
      // move or copy dir
      const relocateDir = (dir: string, copy = false) => {
        const targetDir = join(outputDirAbsolute, dir);
        if (existsSync(targetDir)) {
          Deno.removeSync(targetDir, { recursive: true });
        }
        const srcDir = join(projDir, dir);
        if (existsSync(srcDir)) {
          ensureDirSync(dirname(targetDir));
          if (copy) {
            copySync(srcDir, targetDir);
          } else {
            Deno.renameSync(srcDir, targetDir);
          }
        }
      };
      const moveDir = relocateDir;
      const copyDir = (dir: string) => relocateDir(dir, true);

      // track whether we need to keep the lib dir around
      let keepLibsDir = false;

      // move/copy projResults to output_dir
      fileResults.files.forEach((renderedFile) => {
        // move the renderedFile to the output dir
        const outputFile = join(outputDirAbsolute, renderedFile.file);
        ensureDirSync(dirname(outputFile));
        Deno.renameSync(join(projDir, renderedFile.file), outputFile);

        // files dir
        const keepFiles = !!renderedFile.format.render[kKeepMd];
        keepLibsDir = keepLibsDir || keepFiles;
        if (renderedFile.filesDir) {
          if (keepFiles) {
            copyDir(renderedFile.filesDir);
          } else {
            moveDir(renderedFile.filesDir);
          }
        }

        // resource files
        const resourceDir = join(projDir, dirname(renderedFile.file));
        const globs = renderedFile.resourceFiles.globs;
        const fileResourceFiles = globs.length > 0
          ? resolvePathGlobs(
            resourceDir,
            renderedFile.resourceFiles.globs,
            [],
          )
          : { include: [], exclude: [] };

        // add the explicitly discovered files (if they exist and
        // the output isn't self-contained)
        if (!renderedFile.selfContained) {
          const resultFiles = renderedFile.resourceFiles.files
            .map((file) => join(resourceDir, file))
            .filter(existsSync)
            .map(Deno.realPathSync);
          fileResourceFiles.include.push(...resultFiles);
        }

        // apply removes and filter files dir
        const resourceFiles = fileResourceFiles.include.filter(
          (file: string) => {
            if (fileResourceFiles.exclude.includes(file)) {
              return false;
            } else if (
              renderedFile.filesDir &&
              file.startsWith(join(projDir, renderedFile.filesDir!))
            ) {
              return false;
            } else {
              return true;
            }
          },
        );

        // render file renderedFile
        projResults.files.push({
          input: renderedFile.input,
          markdown: renderedFile.markdown,
          format: renderedFile.format,
          file: renderedFile.file,
          filesDir: renderedFile.filesDir,
          resourceFiles,
        });
      });

      // move or copy the lib dir if we have one (move one subdirectory at a time
      // so that we can merge with what's already there)
      if (libDir) {
        const libDirFull = join(context.dir, libDir);
        if (existsSync(libDirFull)) {
          // if this is an incremental render or we are uzing the freezer, then
          // copy lib dirs incrementally (don't replace the whole directory).
          // otherwise, replace the whole thing so we get a clean start
          const libsIncremental = !!(incremental || options.useFreezer);

          // determine format lib dirs (for pruning)
          const formatLibDirs = projType.formatLibDirs
            ? projType.formatLibDirs()
            : [];

          // lib dir to freezer
          const freezeLibDir = (hidden: boolean) => {
            copyToProjectFreezer(context, libDir, hidden, libsIncremental);
            pruneProjectFreezerDir(context, libDir, formatLibDirs, hidden);
            pruneProjectFreezer(context, hidden);
          };

          // copy to hidden freezer
          freezeLibDir(true);

          // if we have a visible freezer then copy to it as well
          if (existsSync(join(context.dir, kProjectFreezeDir))) {
            freezeLibDir(false);
          }

          if (libsIncremental) {
            for (const lib of Deno.readDirSync(libDirFull)) {
              if (lib.isDirectory) {
                const srcDir = join(libDir, lib.name);
                if (keepLibsDir) {
                  copyDir(srcDir);
                } else {
                  moveDir(srcDir);
                }
              }
            }
            if (!keepLibsDir) {
              Deno.removeSync(libDirFull, { recursive: true });
            }
          } else {
            if (keepLibsDir) {
              copyDir(libDir);
            } else {
              moveDir(libDir);
            }
          }
        }
      }

      // determine the output files and filter them out of the resourceFiles
      const outputFiles = projResults.files.map((result) =>
        join(projDir, result.file)
      );
      projResults.files.forEach((file) => {
        file.resourceFiles = file.resourceFiles.filter((resource) =>
          !outputFiles.includes(resource)
        );
      });

      // copy all of the resource files
      const allResourceFiles = ld.uniq(
        (context.files.resources || []).concat(
          projResults.files.flatMap((file) => file.resourceFiles),
        ),
      );

      // copy the resource files to the output dir
      allResourceFiles.forEach((file: string) => {
        const sourcePath = relative(projDir, file);
        const destPath = join(outputDirAbsolute, sourcePath);
        if (existsSync(file)) {
          if (Deno.statSync(file).isFile) {
            copyResourceFile(context.dir, file, destPath);
          }
        } else if (!existsSync(destPath)) {
          warning(`File '${sourcePath}' was not found.`);
        }
      });
    } else {
      // track output files
      projResults.files.push(
        ...fileResults.files.map((result) => ({
          input: result.input,
          markdown: result.markdown,
          format: result.format,
          file: result.file,
          filesDir: result.filesDir,
          resourceFiles: [],
        })),
      );
    }

    // forward error to projResults
    projResults.error = fileResults.error;

    // call post-render
    if (projType.postRender) {
      await projType.postRender(
        context,
        incremental,
        projResults.files.map((result) => {
          const file = outputDir ? join(outputDir, result.file) : result.file;
          return {
            file: join(projDir, file),
            format: result.format,
          };
        }),
      );
    }

    return projResults;
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}
