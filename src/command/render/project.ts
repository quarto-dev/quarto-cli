/*
 * project.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { info, warning } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { copyMinimal, copyTo } from "../../core/copy.ts";
import * as ld from "../../core/lodash.ts";

import {
  kKeepMd,
  kKeepTex,
  kKeepTyp,
  kTargetFormat,
} from "../../config/constants.ts";

import {
  kProjectExecuteDir,
  kProjectLibDir,
  kProjectPostRender,
  kProjectPreRender,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";

import { projectType } from "../../project/types/project-types.ts";
import { copyResourceFile } from "../../project/project-resources.ts";
import { ensureGitignore } from "../../project/project-gitignore.ts";
import { partitionedMarkdownForInput } from "../../project/project-config.ts";

import { renderFiles } from "./render-files.ts";
import {
  RenderedFile,
  RenderFile,
  RenderOptions,
  RenderResult,
} from "./types.ts";
import {
  copyToProjectFreezer,
  kProjectFreezeDir,
  pruneProjectFreezer,
  pruneProjectFreezerDir,
} from "./freeze.ts";
import { resourceFilesFromRenderedFile } from "./resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import {
  removeIfEmptyDir,
  removeIfExists,
  safeRemoveIfExists,
} from "../../core/path.ts";
import { handlerForScript } from "../../core/run/run.ts";
import { execProcess } from "../../core/process.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";
import { clearProjectIndex } from "../../project/project-index.ts";
import {
  hasProjectOutputDir,
  projectExcludeDirs,
  projectFormatOutputDir,
  projectOutputDir,
} from "../../project/project-shared.ts";
import { asArray } from "../../core/array.ts";
import { normalizePath } from "../../core/path.ts";
import { isSubdir } from "fs/_util.ts";
import { Format } from "../../config/types.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";
import { projectContextForDirectory } from "../../project/project-context.ts";
import { ProjectType } from "../../project/types/types.ts";

const noMutationValidations = (
  projType: ProjectType,
  projOutputDir: string,
  projDir: string,
) => {
  return [{
    val: projType,
    newVal: (context: ProjectContext) => {
      return projectType(context.config?.project?.[kProjectType]);
    },
    msg: "The project type may not be mutated by the pre-render script",
  }, {
    val: projOutputDir,
    newVal: (context: ProjectContext) => {
      return projectOutputDir(context);
    },
    msg: "The project output-dir may not be mutated by the pre-render script",
  }, {
    val: projDir,
    newVal: (context: ProjectContext) => {
      return normalizePath(context.dir);
    },
    msg: "The project dir may not be mutated by the pre-render script",
  }];
};

interface ProjectInputs {
  projType: ProjectType;
  projOutputDir: string;
  projDir: string;
  context: ProjectContext;
  files: string[] | undefined;
  options: RenderOptions;
}

interface ProjectRenderConfig {
  behavior: {
    incremental: boolean;
    renderAll: boolean;
  };
  alwaysExecuteFiles: string[] | undefined;
  filesToRender: RenderFile[];
  options: RenderOptions;
  supplements: {
    files: RenderFile[];
    onRenderComplete?: (
      project: ProjectContext,
      files: string[],
      incremental: boolean,
    ) => Promise<void>;
  };
}

const computeProjectRenderConfig = async (
  inputs: ProjectInputs,
): Promise<ProjectRenderConfig> => {
  // is this an incremental render?
  const incremental = !!inputs.files;

  // force execution for any incremental files (unless options.useFreezer is set)
  let alwaysExecuteFiles = incremental && !inputs.options.useFreezer
    ? ld.cloneDeep(inputs.files) as string[]
    : undefined;

  // file normaliation
  const normalizeFiles = (targetFiles: string[]) => {
    return targetFiles.map((file) => {
      const target = isAbsolute(file) ? file : join(Deno.cwd(), file);
      if (!existsSync(target)) {
        throw new Error("Render target does not exist: " + file);
      }
      return normalizePath(target);
    });
  };

  if (inputs.files) {
    if (alwaysExecuteFiles) {
      alwaysExecuteFiles = normalizeFiles(alwaysExecuteFiles);
      inputs.files = normalizeFiles(inputs.files);
    } else if (inputs.options.useFreezer) {
      inputs.files = normalizeFiles(inputs.files);
    }
  }

  // check with the project type to see if we should render all
  // of the files in the project with the freezer enabled (required
  // for projects that produce self-contained output from a
  // collection of input files)
  if (
    inputs.files && alwaysExecuteFiles &&
    inputs.projType.incrementalRenderAll &&
    await inputs.projType.incrementalRenderAll(
      inputs.context,
      inputs.options,
      inputs.files,
    )
  ) {
    inputs.files = inputs.context.files.input;
    inputs.options = { ...inputs.options, useFreezer: true };
  }

  // some standard pre and post render script env vars
  const renderAll = !inputs.files ||
    (inputs.files.length === inputs.context.files.input.length);

  // default for files if not specified
  inputs.files = inputs.files || inputs.context.files.input;
  const filesToRender: RenderFile[] = inputs.files.map((file) => {
    return { path: file };
  });

  // See if the project type needs to add additional render files
  // that should be rendered as a side effect of rendering the file(s)
  // in the render list.
  // We don't add supplemental files when this is a dev server reload
  // to improve render performance
  const projectSupplement = (filesToRender: RenderFile[]) => {
    if (inputs.projType.supplementRender && !inputs.options.devServerReload) {
      return inputs.projType.supplementRender(
        inputs.context,
        filesToRender,
        incremental,
      );
    } else {
      return { files: [] };
    }
  };
  const supplements = projectSupplement(filesToRender);
  filesToRender.push(...supplements.files);

  return {
    alwaysExecuteFiles,
    filesToRender,
    options: inputs.options,
    supplements,
    behavior: {
      renderAll,
      incremental,
    },
  };
};

export async function renderProject(
  context: ProjectContext,
  pOptions: RenderOptions,
  pFiles?: string[],
): Promise<RenderResult> {
  // lookup the project type
  const projType = projectType(context.config?.project?.[kProjectType]);

  const projOutputDir = projectOutputDir(context);

  // get real path to the project
  const projDir = normalizePath(context.dir);

  let projectRenderConfig = await computeProjectRenderConfig({
    context,
    projType,
    projOutputDir,
    projDir,
    options: pOptions,
    files: pFiles,
  });

  // ensure we have the requisite entries in .gitignore
  await ensureGitignore(context.dir);

  // determine whether pre and post render steps should show progress
  const progress = !!projectRenderConfig.options.progress ||
    (projectRenderConfig.filesToRender.length > 1);

  // if there is an output dir then remove it if clean is specified
  if (
    projectRenderConfig.behavior.renderAll && hasProjectOutputDir(context) &&
    (projectRenderConfig.options.forceClean ||
      (projectRenderConfig.options.flags?.clean == true) &&
        (projType.cleanOutputDir === true))
  ) {
    // ouptut dir
    const realProjectDir = normalizePath(context.dir);
    if (existsSync(projOutputDir)) {
      const realOutputDir = normalizePath(projOutputDir);
      if (
        (realOutputDir !== realProjectDir) &&
        realOutputDir.startsWith(realProjectDir)
      ) {
        removeIfExists(realOutputDir);
      }
    }
    // remove index
    clearProjectIndex(realProjectDir);
  }

  // Create the environment that needs to be made available to the
  // pre/post render scripts.
  const prePostEnv = {
    "QUARTO_PROJECT_OUTPUT_DIR": projOutputDir,
    ...(projectRenderConfig.behavior.renderAll
      ? { QUARTO_PROJECT_RENDER_ALL: "1" }
      : {}),
  };

  // run pre-render step if we are rendering all files
  if (context.config?.project?.[kProjectPreRender]) {
    await runPreRender(
      projDir,
      asArray(context.config?.project?.[kProjectPreRender]!),
      progress,
      !!projectRenderConfig.options.flags?.quiet,
      {
        ...prePostEnv,
        QUARTO_PROJECT_INPUT_FILES: projectRenderConfig.filesToRender
          .map((fileToRender) => fileToRender.path)
          .map((file) => relative(projDir, file))
          .join("\n"),
      },
    );

    // re-initialize project context
    context = await projectContextForDirectory(
      context.dir,
      context.notebookContext,
      projectRenderConfig.options,
    );

    // Validate that certain project properties haven't been mutated
    noMutationValidations(projType, projOutputDir, projDir).some(
      (validation) => {
        if (!ld.isEqual(validation.newVal(context), validation.val)) {
          throw new Error(
            `Pre-render script resulted in a project change that is now allowed.\n${validation.msg}`,
          );
        }
      },
    );

    // Recompute the project render list (filesToRender)
    projectRenderConfig = await computeProjectRenderConfig({
      context,
      projType,
      projOutputDir,
      projDir,
      options: pOptions,
      files: pFiles,
    });
  }

  // lookup the project type and call preRender
  if (projType.preRender) {
    await projType.preRender(context);
  }

  // set execute dir if requested
  const executeDir = context.config?.project?.[kProjectExecuteDir];
  if (
    projectRenderConfig.options.flags?.executeDir === undefined &&
    executeDir === "project"
  ) {
    projectRenderConfig.options = {
      ...projectRenderConfig.options,
      flags: {
        ...projectRenderConfig.options.flags,
        executeDir: projDir,
      },
    };
  }

  // set executeDaemon to 0 for renders of the entire project
  // or a list of more than 3 files (don't want to leave dozens of
  // kernels in memory). we use 3 rather than 1 because w/ blogs
  // and listings there may be addtional files added to the render list
  if (
    projectRenderConfig.filesToRender.length > 3 &&
    projectRenderConfig.options.flags &&
    projectRenderConfig.options.flags.executeDaemon === undefined
  ) {
    projectRenderConfig.options.flags.executeDaemon = 0;
  }

  // projResults to return
  const projResults: RenderResult = {
    context,
    baseDir: projDir,
    outputDir: relative(projDir, projOutputDir),
    files: [],
  };

  // determine the output dir
  const outputDir = projResults.outputDir;
  const outputDirAbsolute = outputDir ? join(projDir, outputDir) : undefined;
  if (outputDirAbsolute) {
    ensureDirSync(outputDirAbsolute);
  }

  // track the lib dir
  const libDir = context.config?.project[kProjectLibDir];

  // function to extract resource files from rendered file
  const resourcesFrom = async (file: RenderedFile) => {
    // resource files
    const partitioned = await partitionedMarkdownForInput(
      context,
      file.input,
    );
    const excludeDirs = context ? projectExcludeDirs(context) : [];

    const resourceFiles = resourceFilesFromRenderedFile(
      projDir,
      excludeDirs,
      file,
      partitioned,
    );
    return resourceFiles;
  };

  // render the files
  const fileResults = await renderFiles(
    projectRenderConfig.filesToRender,
    projectRenderConfig.options,
    context.notebookContext,
    projectRenderConfig.alwaysExecuteFiles,
    projType?.pandocRenderer
      ? projType.pandocRenderer(projectRenderConfig.options, context)
      : undefined,
    context,
  );

  const directoryRelocator = (destinationDir: string) => {
    // move or copy dir
    return (dir: string, copy = false) => {
      const targetDir = join(destinationDir, dir);
      const srcDir = join(projDir, dir);
      // Dont' remove the directory unless there is a source
      // directory that we can relocate
      //
      // If we intend for the directory relocated to be used to
      // remove directories, we should instead make a function that
      // does that explicitly, rather than as a side effect of a missing
      // src Dir
      if (existsSync(srcDir)) {
        if (existsSync(targetDir)) {
          Deno.removeSync(targetDir, { recursive: true });
        }
        ensureDirSync(dirname(targetDir));
        if (copy) {
          copyTo(srcDir, targetDir);
        } else {
          Deno.renameSync(srcDir, targetDir);
        }
      }
    };
  };

  let moveOutputResult: Record<string, unknown> | undefined;
  if (outputDirAbsolute) {
    // track whether we need to keep the lib dir around
    let keepLibsDir = false;

    interface FileOperation {
      key: string;
      src: string;
      performOperation: () => void;
    }
    const fileOperations: FileOperation[] = [];

    // move/copy projResults to output_dir
    for (let i = 0; i < fileResults.files.length; i++) {
      const renderedFile = fileResults.files[i];

      const formatOutputDir = projectFormatOutputDir(
        renderedFile.format,
        context,
        projectType(context.config?.project.type),
      );

      const formatRelocateDir = directoryRelocator(formatOutputDir);
      const moveFormatDir = formatRelocateDir;
      const copyFormatDir = (dir: string) => formatRelocateDir(dir, true);

      // move the renderedFile to the output dir
      if (!renderedFile.isTransient) {
        const outputFile = join(formatOutputDir, renderedFile.file);
        ensureDirSync(dirname(outputFile));
        Deno.renameSync(join(projDir, renderedFile.file), outputFile);
      }

      // files dir
      const keepFiles = !!renderedFile.format.execute[kKeepMd] ||
        !!renderedFile.format.render[kKeepTex] ||
        !!renderedFile.format.render[kKeepTyp];
      keepLibsDir = keepLibsDir || keepFiles;
      if (renderedFile.supporting) {
        // lib-dir is handled separately for projects so filter it out of supporting
        renderedFile.supporting = renderedFile.supporting.filter((file) =>
          file !== libDir
        );
        // ensure that we don't have overlapping paths in supporting
        renderedFile.supporting = renderedFile.supporting.filter((file) => {
          return !renderedFile.supporting!.some((dir) =>
            file.startsWith(dir) && file !== dir
          );
        });
        if (keepFiles) {
          renderedFile.supporting.forEach((file) => {
            fileOperations.push({
              key: `${file}|copy`,
              src: file,
              performOperation: () => {
                copyFormatDir(file);
              },
            });
          });
        } else {
          renderedFile.supporting.forEach((file) => {
            fileOperations.push({
              key: `${file}|move`,
              src: file,
              performOperation: () => {
                moveFormatDir(file);
                removeIfEmptyDir(dirname(file));
              },
            });
          });
        }
      }

      // remove empty files dir
      if (!keepFiles) {
        const filesDir = join(
          projDir,
          dirname(renderedFile.file),
          inputFilesDir(renderedFile.file),
        );
        removeIfEmptyDir(filesDir);
      }

      // render file renderedFile
      projResults.files.push({
        isTransient: renderedFile.isTransient,
        input: renderedFile.input,
        markdown: renderedFile.markdown,
        format: renderedFile.format,
        file: renderedFile.file,
        supporting: renderedFile.supporting,
        resourceFiles: await resourcesFrom(renderedFile),
      });
    }

    // Sort the operations in order from shallowest to deepest
    // This means that parent directories will happen first (so for example
    // foo_files will happen before foo_files/figure-html). This is
    // desirable because if the order of operations is something like:
    //
    // foo_files/figure-html (move)
    // foo_files             (move)
    //
    // The second operation overwrites the folder foo_files with a copy that is
    // missing the figure_html directory. (Render a document to JATS and HTML
    // as an example case)
    const uniqOps = ld.uniqBy(fileOperations, (op: FileOperation) => {
      return op.key;
    });

    const sortedOperations = uniqOps.sort((a, b) => {
      if (a.src === b.src) {
        return 0;
      } else {
        if (isSubdir(a.src, b.src)) {
          return -1;
        } else {
          return a.src.localeCompare(b.src);
        }
      }
    });

    // Before file move
    if (projType.beforeMoveOutput) {
      moveOutputResult = await projType.beforeMoveOutput(
        context,
        projResults.files,
      );
    }

    sortedOperations.forEach((op) => {
      op.performOperation();
    });

    // move or copy the lib dir if we have one (move one subdirectory at a time
    // so that we can merge with what's already there)
    if (libDir) {
      const libDirFull = join(context.dir, libDir);
      if (existsSync(libDirFull)) {
        // if this is an incremental render or we are uzing the freezer, then
        // copy lib dirs incrementally (don't replace the whole directory).
        // otherwise, replace the whole thing so we get a clean start
        const libsIncremental = !!(projectRenderConfig.behavior.incremental ||
          projectRenderConfig.options.useFreezer);

        // determine format lib dirs (for pruning)
        const formatLibDirs = projType.formatLibDirs
          ? projType.formatLibDirs()
          : [];

        // lib dir to freezer
        const freezeLibDir = (hidden: boolean) => {
          copyToProjectFreezer(context, libDir, hidden, false);
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
              const copyDir = join(libDir, lib.name);
              const srcDir = join(projDir, copyDir);
              const targetDir = join(outputDirAbsolute, copyDir);
              copyMinimal(srcDir, targetDir);
              if (!keepLibsDir) {
                safeRemoveIfExists(srcDir);
              }
            }
          }
          if (!keepLibsDir) {
            safeRemoveIfExists(libDirFull);
          }
        } else {
          // move or copy dir
          const relocateDir = directoryRelocator(outputDirAbsolute);
          if (keepLibsDir) {
            relocateDir(libDir, true);
          } else {
            relocateDir(libDir);
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

    // Expand the resources into the format aware targets
    // srcPath -> Set<destinationPaths>
    const resourceFilesToCopy: Record<string, Set<string>> = {};

    const projectFormats: Record<string, Format> = {};
    projResults.files.forEach((file) => {
      if (
        file.format.identifier[kTargetFormat] &&
        projectFormats[file.format.identifier[kTargetFormat]] === undefined
      ) {
        projectFormats[file.format.identifier[kTargetFormat]] = file.format;
      }
    });

    const isSelfContainedOutput = (format: Format) => {
      return projType.selfContainedOutput &&
        projType.selfContainedOutput(format);
    };

    Object.values(projectFormats).forEach((format) => {
      // Don't copy resource files if the project produces a self-contained output
      if (isSelfContainedOutput(format)) {
        return;
      }

      // Process the project resources
      const formatOutputDir = projectFormatOutputDir(
        format,
        context,
        projType,
      );
      context.files.resources?.forEach((resource) => {
        resourceFilesToCopy[resource] = resourceFilesToCopy[resource] ||
          new Set();
        const relativePath = relative(context.dir, resource);
        resourceFilesToCopy[resource].add(
          join(formatOutputDir, relativePath),
        );
      });
    });

    // Process the resources provided by the files themselves
    projResults.files.forEach((file) => {
      // Don't copy resource files if the project produces a self-contained output
      if (isSelfContainedOutput(file.format)) {
        return;
      }

      const formatOutputDir = projectFormatOutputDir(
        file.format,
        context,
        projType,
      );
      file.resourceFiles.forEach((file) => {
        resourceFilesToCopy[file] = resourceFilesToCopy[file] || new Set();
        const relativePath = relative(projDir, file);
        resourceFilesToCopy[file].add(join(formatOutputDir, relativePath));
      });
    });

    // Actually copy the resource files
    Object.keys(resourceFilesToCopy).forEach((srcPath) => {
      const destinationFiles = resourceFilesToCopy[srcPath];
      destinationFiles.forEach((destPath: string) => {
        if (existsSync(srcPath)) {
          if (Deno.statSync(srcPath).isFile) {
            copyResourceFile(context.dir, srcPath, destPath);
          }
        } else if (!existsSync(destPath)) {
          warning(`File '${srcPath}' was not found.`);
        }
      });
    });
  } else {
    for (const result of fileResults.files) {
      const resourceFiles = await resourcesFrom(result);
      projResults.files.push({
        input: result.input,
        markdown: result.markdown,
        format: result.format,
        file: result.file,
        supporting: result.supporting,
        resourceFiles,
      });
    }
  }

  // forward error to projResults
  projResults.error = fileResults.error;

  // call engine and project post-render
  if (!projResults.error) {
    // engine post-render
    for (const file of projResults.files) {
      const path = join(context.dir, file.input);
      const engine = await fileExecutionEngine(
        path,
        projectRenderConfig.options.flags,
        context,
      );
      if (engine?.postRender) {
        await engine.postRender(file, projResults.context);
      }
    }

    // compute output files
    const outputFiles = projResults.files
      .filter((x) => !x.isTransient)
      .map((result) => {
        const outputDir = projectFormatOutputDir(
          result.format,
          context,
          projType,
        );
        const file = outputDir
          ? join(outputDir, result.file)
          : join(projDir, result.file);
        return {
          file,
          input: join(projDir, result.input),
          format: result.format,
          resources: result.resourceFiles,
          supporting: result.supporting,
        };
      });

    if (projType.postRender) {
      await projType.postRender(
        context,
        projectRenderConfig.behavior.incremental,
        outputFiles,
        moveOutputResult,
      );
    }

    // run post-render if this isn't incremental
    if (context.config?.project?.[kProjectPostRender]) {
      await runPostRender(
        projDir,
        asArray(context.config?.project?.[kProjectPostRender]!),
        progress,
        !!projectRenderConfig.options.flags?.quiet,
        {
          ...prePostEnv,
          QUARTO_PROJECT_OUTPUT_FILES: outputFiles
            .map((outputFile) => relative(projDir, outputFile.file))
            .join("\n"),
        },
      );
    }
  }

  // Mark any rendered files as supplemental if that
  // is how they got into the render list
  const supplements = projectRenderConfig.supplements;
  projResults.files.forEach((file) => {
    if (
      supplements.files.find((supFile) => {
        return supFile.path === join(projDir, file.input);
      })
    ) {
      file.supplemental = true;
    }
  });

  // Also let the project know that the render has completed for
  // any non supplemental files
  const nonSupplementalFiles = projResults.files.filter((file) =>
    !file.supplemental
  ).map((file) => file.file);
  if (supplements.onRenderComplete) {
    await supplements.onRenderComplete(
      context,
      nonSupplementalFiles,
      projectRenderConfig.behavior.incremental,
    );
  }
  return projResults;
}

async function runPreRender(
  projDir: string,
  preRender: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  await runScripts(projDir, preRender, progress, quiet, env);
}

async function runPostRender(
  projDir: string,
  postRender: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  await runScripts(projDir, postRender, progress, quiet, env);
}

async function runScripts(
  projDir: string,
  scripts: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  for (let i = 0; i < scripts.length; i++) {
    const args = parseShellRunCommand(scripts[i]);
    const script = args[0];

    if (progress && !quiet) {
      info(colors.bold(colors.blue(`${script}`)));
    }

    const handler = handlerForScript(script);
    if (handler) {
      const result = await handler.run(script, args.splice(1), undefined, {
        cwd: projDir,
        stdout: quiet ? "piped" : "inherit",
        env,
      });
      if (!result.success) {
        throw new Error();
      }
    } else {
      const result = await execProcess({
        cmd: args,
        cwd: projDir,
        stdout: quiet ? "piped" : "inherit",
        env,
      });
      if (!result.success) {
        throw new Error();
      }
    }
  }
  if (scripts.length > 0) {
    info("");
  }
}
