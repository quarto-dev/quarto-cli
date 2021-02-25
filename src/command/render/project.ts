/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { copySync, ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { basename, dirname, extname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../../core/path.ts";
import { message } from "../../core/console.ts";

import { FormatPandoc } from "../../config/format.ts";

import { executionEngine } from "../../execute/engine.ts";

import {
  kExecuteDir,
  kLibDir,
  kOutputDir,
  kResources,
  ProjectContext,
} from "../../config/project.ts";

import { projectType } from "../../project/types/project-types.ts";

import { renderFiles, RenderOptions, RenderResults } from "./render.ts";

export async function renderProject(
  context: ProjectContext,
  files: string[],
  options: RenderOptions,
): Promise<RenderResults> {
  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

  // lookup the project type and call preRender
  // TODO: merge formatPandoc
  // TODO: call post-render
  let formatPandoc: FormatPandoc | undefined;
  if (context.metadata) {
    const projType = projectType(context.metadata.project?.type);
    const { project = undefined, pandoc = undefined } = projType.preRender
      ? projType.preRender(context)
      : {};

    // if we got a project back then replace ours
    if (project) {
      context.metadata.project = project;
    }
    if (pandoc) {
      formatPandoc = pandoc;
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

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", projDir);
  try {
    // render the files
    const fileResults = await renderFiles(files, options, context);

    // move to the output directory if we have one
    const outputDir = context.metadata?.project?.[kOutputDir];

    if (outputDir) {
      // determine global list of included resource files
      let resourceFiles: string[] = [];
      const resourceGlobs = context.metadata?.project?.[kResources];
      if (resourceGlobs) {
        const exclude = outputDir ? [outputDir] : [];
        const projectResourceFiles = resolvePathGlobs(
          context.dir,
          resourceGlobs,
          exclude,
        );
        resourceFiles.push(
          ...ld.difference(
            projectResourceFiles.include,
            projectResourceFiles.exclude,
          ),
        );
      }

      // resolve output dir and ensure that it exists
      let realOutputDir = join(projDir, outputDir);
      ensureDirSync(realOutputDir);
      realOutputDir = Deno.realPathSync(realOutputDir);

      // function to move a directory into the output dir
      const moveDir = (dir: string) => {
        const targetDir = join(realOutputDir, dir);
        if (existsSync(targetDir)) {
          Deno.removeSync(targetDir, { recursive: true });
        }
        const srcDir = join(projDir, dir);
        ensureDirSync(dirname(targetDir));
        Deno.renameSync(srcDir, targetDir);
      };

      // move the lib dir if we have one (move one subdirectory at a time so that we can
      // merge with what's already there)
      const libDir = context.metadata?.project?.[kLibDir];
      if (libDir) {
        for (const lib of Deno.readDirSync(join(context.dir, libDir))) {
          if (lib.isDirectory) {
            moveDir(join(libDir, basename(lib.name)));
          }
        }
        Deno.removeSync(join(context.dir, libDir), { recursive: true });
      }

      // move/copy results to output_dir
      Object.keys(fileResults).forEach((format) => {
        const results = fileResults[format];

        for (const result of results) {
          // output file
          const outputFile = join(realOutputDir, result.file);
          ensureDirSync(dirname(outputFile));
          Deno.renameSync(join(projDir, result.file), outputFile);

          // files dir
          if (result.filesDir) {
            moveDir(result.filesDir);
          }

          // resource files
          const resourceDir = join(projDir, dirname(result.file));
          const fileResourceFiles = resolvePathGlobs(
            resourceDir,
            result.resourceFiles.globs,
            [],
          );

          // merge the resolved globs into the global list
          resourceFiles.push(...fileResourceFiles.include);

          // add the explicitly discovered files (if they exist and
          // the output isn't self-contained)
          if (!result.selfContained) {
            resourceFiles.push(
              ...result.resourceFiles.files
                .filter((file) => existsSync(join(resourceDir, file)))
                .map((file) => Deno.realPathSync(join(resourceDir, file))),
            );
          }

          // apply removes and filter files dir
          resourceFiles = resourceFiles.filter((file) => {
            if (fileResourceFiles.exclude.includes(file)) {
              return false;
            } else if (
              result.filesDir &&
              file.startsWith(join(projDir, result.filesDir!))
            ) {
              return false;
            } else {
              return true;
            }
          });
        }
      });

      // make resource files unique
      resourceFiles = ld.uniq(resourceFiles);

      // copy the resource files to the output dir
      resourceFiles.forEach((file) => {
        const sourcePath = relative(projDir, file);
        if (existsSync(file)) {
          const destPath = join(realOutputDir, sourcePath);
          copyResourceFile(context.dir, file, destPath);
        } else {
          message(`WARNING: File '${sourcePath}' was not found.`);
        }
      });
    }

    return {
      baseDir: context.dir,
      outputDir: outputDir,
      results: fileResults,
    };
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}

function copyResourceFile(rootDir: string, srcFile: string, destFile: string) {
  // ensure that the resource reference doesn't escape the root dir
  if (!Deno.realPathSync(srcFile).startsWith(Deno.realPathSync(rootDir))) {
    return;
  }

  ensureDirSync(dirname(destFile));
  copySync(srcFile, destFile, {
    overwrite: true,
    preserveTimestamps: true,
  });

  if (extname(srcFile).toLowerCase() === ".css") {
    handleCssReferences(rootDir, srcFile, destFile);
  }
}

// fixup root ('/') css references and also copy references to other
// stylesheet or resources (e.g. images) to alongside the destFile
function handleCssReferences(
  rootDir: string,
  srcFile: string,
  destFile: string,
) {
  // read the css
  const css = Deno.readTextFileSync(destFile);

  // offset for root references
  const offset = relative(dirname(srcFile), rootDir);

  // function that can be used to copy a ref
  const copyRef = (ref: string) => {
    const refPath = join(dirname(srcFile), ref);
    if (existsSync(refPath)) {
      const refDestPath = join(dirname(destFile), ref);
      copyResourceFile(rootDir, refPath, refDestPath);
    }
  };

  // fixup / copy refs from url()
  const kUrlRegex = /url\((?!['"]?(?:data|https?):)(['"])?([^'"]*)\1\)/g;
  let destCss = css.replaceAll(
    kUrlRegex,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      copyRef(ref);
      return `url(${p1}${ref}${p1})`;
    },
  );

  // fixup / copy refs from @import
  const kImportRegEx = /@import\s(?!['"](?:data|https?):)(['"])([^'"]*)\1/g;
  destCss = destCss.replaceAll(
    kImportRegEx,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      copyRef(ref);
      return `@import ${p1}${ref}${p1}`;
    },
  );

  // write the css if necessary
  if (destCss !== css) {
    Deno.writeTextFileSync(destFile, destCss);
  }
}

export function projectInputFiles(context: ProjectContext) {
  const files: string[] = [];
  const keepMdFiles: string[] = [];

  const addFile = (file: string) => {
    const engine = executionEngine(file);
    if (engine) {
      files.push(file);
      const keepMd = engine.keepMd(file);
      if (keepMd) {
        keepMdFiles.push(keepMd);
      }
    }
  };

  const addDir = (dir: string) => {
    for (
      const walk of walkSync(
        dir,
        { includeDirs: false, followSymlinks: true, skip: [/^_/] },
      )
    ) {
      addFile(walk.path);
    }
  };

  const renderFiles = context.metadata?.project?.render;
  if (renderFiles) {
    const outputDir = context.metadata?.project?.[kOutputDir];
    const exclude = outputDir ? [outputDir] : [];
    const resolved = resolvePathGlobs(context.dir, renderFiles, exclude);
    (ld.difference(resolved.include, resolved.exclude) as string[])
      .forEach((file) => {
        if (Deno.statSync(file).isDirectory) {
          addDir(file);
        } else {
          addFile(file);
        }
      });
  } else {
    addDir(context.dir);
  }

  return ld.difference(ld.uniq(files), keepMdFiles) as string[];
}
