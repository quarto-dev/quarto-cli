/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { sessionTempDir } from "../../core/temp.ts";

import {
  formatFromMetadata,
  includedMetadata,
  Metadata,
  metadataAsFormat,
} from "../../config/metadata.ts";
import {
  kCache,
  kExecute,
  kKeepMd,
  kKernelDebug,
  kKernelKeepalive,
  kKernelRestart,
  kMetadataFile,
  kMetadataFiles,
  kMetadataFormat,
} from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  executionEngine,
  ExecutionTarget,
  PandocResult,
} from "../../execute/engine.ts";

import { pandocMetadataPath, PandocOptions, runPandoc } from "./pandoc.ts";
import { removePandocToArg, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { ProjectContext, projectContext } from "../../config/project.ts";
import { projectInputFiles, renderProject } from "./project.ts";

// command line options for render
export interface RenderOptions {
  flags?: RenderFlags;
  pandocArgs?: string[];
}

// context for render
export interface RenderContext {
  target: ExecutionTarget;
  options: RenderOptions;
  engine: ExecutionEngine;
  format: Format;
  project?: ProjectContext;
}

export interface RenderResult {
  input: string;
  file: string;
  filesDir?: string;
  resourceFiles: string[];
}

export interface RenderResults {
  baseDir?: string;
  outputDir?: string;
  results: Record<string, RenderResult[]>;
}

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResults> {
  // determine target context/files
  const context = projectContext(path);

  if (Deno.statSync(path).isDirectory) {
    // all directories are considered projects
    return await renderProject(context, projectInputFiles(context), options);
  } else if (context.metadata) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    const projFiles = projectInputFiles(context);
    const renderPath = Deno.realPathSync(path);
    if (projFiles.map((file) => Deno.realPathSync(file)).includes(renderPath)) {
      return await renderProject(context, [path], options);
    } else {
      // otherwise it's just a file render
      return {
        results: await renderFiles([path], options),
      };
    }
  } else {
    // not a directory and not a file with a _quarto project parent
    return {
      results: await renderFiles([path], options),
    };
  }
}

export async function renderFiles(
  files: string[],
  options: RenderOptions,
  project?: ProjectContext,
): Promise<Record<string, RenderResult[]>> {
  const results: Record<string, RenderResult[]> = {};

  for (const file of files) {
    // get contexts
    const contexts = await renderContexts(file, options, project);

    // remove --to (it's been resolved into contexts)
    delete options.flags?.to;
    if (options.pandocArgs) {
      options.pandocArgs = removePandocToArg(options.pandocArgs);
    }

    const fileResults: RenderResult[] = [];

    for (const context of Object.values(contexts)) {
      // execute
      const executeResult = await renderExecute(context, true);

      // run pandoc
      const pandocResult = await renderPandoc(context, executeResult);

      // determine if we have a files dir
      const filesDir = executeResult.files_dir &&
          existsSync(join(dirname(file), executeResult.files_dir))
        ? executeResult.files_dir
        : undefined;

      // if there is a project context then return paths relative to the project
      const projectPath = (path: string) => {
        if (project) {
          return relative(
            Deno.realPathSync(project.dir),
            Deno.realPathSync(join(dirname(file), basename(path))),
          );
        } else {
          return path;
        }
      };

      fileResults.push({
        input: projectPath(file),
        file: projectPath(pandocResult.finalOutput),
        filesDir: filesDir ? projectPath(filesDir) : undefined,
        resourceFiles: pandocResult.resourceFiles,
      });
    }

    results[file] = fileResults;
  }

  return results;
}

export async function renderContexts(
  file: string,
  options: RenderOptions,
  project?: ProjectContext,
): Promise<Record<string, RenderContext>> {
  // determine the computation engine and any alternate input file
  const engine = await executionEngine(file);
  if (!engine) {
    throw new Error("Unable to render " + file);
  }
  const target = await engine.target(file, options.flags?.quiet);
  if (!target) {
    throw new Error("Unable to render " + file);
  }

  // resolve render target
  const formats = await resolveFormats(target, engine, options.flags);

  // return contexts
  const contexts: Record<string, RenderContext> = {};
  Object.keys(formats).forEach((format) => {
    contexts[format] = {
      target,
      options,
      engine,
      format: formats[format],
      project,
    };
  });
  return contexts;
}

export async function renderExecute(
  context: RenderContext,
  resolveDependencies: boolean,
): Promise<ExecuteResult> {
  // alias flags
  const flags = context.options.flags || {};

  // execute computations
  const executeResult = await context.engine.execute({
    target: context.target,
    resourceDir: resourcePath(),
    tempDir: sessionTempDir(),
    dependencies: resolveDependencies,
    format: context.format,
    cwd: flags.executeDir,
    params: resolveParams(flags.params, flags.paramsFile),
    quiet: flags.quiet,
  });

  // keep md if requested
  const keepMd = context.engine.keepMd(context.target.input);
  if (keepMd && context.format.render[kKeepMd]) {
    Deno.writeTextFileSync(keepMd, executeResult.markdown);
  }

  // return result
  return executeResult;
}

export async function renderPandoc(
  context: RenderContext,
  executeResult: ExecuteResult,
): Promise<PandocResult> {
  // merge any pandoc options provided the computation
  context.format.pandoc = mergeConfigs(
    context.format.pandoc || {},
    executeResult.pandoc,
  );

  // pandoc output recipe (target file, args, complete handler)
  const recipe = await outputRecipe(
    context.target.source,
    context.options,
    context.format,
  );

  // run the dependencies step if we didn't do it during execution
  if (executeResult.dependencies) {
    const dependenciesResult = await context.engine.dependencies({
      target: context.target,
      format: context.format,
      output: recipe.output,
      resourceDir: resourcePath(),
      tempDir: sessionTempDir(),
      libDir: undefined, // TODO
      dependencies: [executeResult.dependencies],
      quiet: context.options.flags?.quiet,
    });
    recipe.format.pandoc = mergeConfigs(
      recipe.format.pandoc,
      dependenciesResult.pandoc,
    );
  }

  // pandoc options
  const pandocOptions: PandocOptions = {
    markdown: executeResult.markdown,
    cwd: dirname(context.target.input),
    format: recipe.format,
    args: recipe.args,
    flags: context.options.flags,
  };

  // add offset if we are in a project
  if (context.project) {
    const projDir = Deno.realPathSync(context.project.dir);
    const inputDir = Deno.realPathSync(dirname(context.target.input));
    const offset = relative(inputDir, projDir);
    if (offset) {
      pandocOptions.offset = pandocMetadataPath(offset);
    }
  }

  // run pandoc conversion (exit on failure)
  const pandocResult = await runPandoc(pandocOptions, executeResult.filters);
  if (!pandocResult) {
    return Promise.reject();
  }

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (executeResult.preserve) {
    await context.engine.postprocess({
      engine: context.engine,
      target: context.target,
      format: context.format,
      output: recipe.output,
      preserve: executeResult.preserve,
      quiet: context.options.flags?.quiet,
    });
  }

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as required
  const flags = context.options.flags || {};
  cleanup(
    flags,
    context.format,
    finalOutput,
    executeResult.supporting,
    context.engine.keepMd(context.target.input),
  );

  // return result
  return {
    finalOutput,
    resourceFiles: pandocResult.resourceFiles,
  };
}

async function resolveFormats(
  target: ExecutionTarget,
  engine: ExecutionEngine,
  flags?: RenderFlags,
): Promise<Record<string, Format>> {
  // merge input metadata into project metadata
  const inputMetadata = await engine.metadata(target);
  const projMetadata = projectContext(target.input).metadata || {};
  const baseMetadata = mergeConfigs(
    projMetadata,
    inputMetadata,
  );

  // Read any included metadata files and merge in and metadata from the command
  const includeMetadata = includedMetadata(baseMetadata);
  const allMetadata = mergeConfigs(
    baseMetadata,
    includeMetadata,
    flags?.metadata,
  );

  // Remove the metadata file / files since we've read them and merged them
  // into the metadata
  delete allMetadata[kMetadataFile];
  delete allMetadata[kMetadataFiles];

  // divide metadata into format buckets
  const baseFormat = metadataAsFormat(allMetadata);

  // determine all target formats (use original input and
  // project metadata to preserve order of keys and to
  // prefer input-level format keys to project-level)
  const formatKeys = (metadata: Metadata): string[] => {
    if (typeof metadata[kMetadataFormat] === "string") {
      return [metadata[kMetadataFormat] as string];
    } else if (metadata[kMetadataFormat] instanceof Object) {
      return Object.keys(metadata[kMetadataFormat] as Metadata);
    } else {
      return [];
    }
  };
  const formats = formatKeys(inputMetadata).concat(formatKeys(projMetadata));

  // provide html if there was no format info
  if (formats.length === 0) {
    formats.push("html");
  }

  // determine render formats
  const renderFormats: string[] = [];
  if (flags?.to) {
    if (flags.to === "all") {
      renderFormats.push(...formats);
    } else {
      renderFormats.push(...flags.to.split(","));
    }
  } else if (formats.length > 0) {
    renderFormats.push(formats[0]);
  } else {
    renderFormats.push(
      baseFormat.pandoc.to || baseFormat.pandoc.writer || "html",
    );
  }

  const resolved: Record<string, Format> = {};

  renderFormats.forEach((to) => {
    // determine the target format
    const format = formatFromMetadata(
      baseFormat,
      to,
      flags?.debug,
    );

    // merge configs
    const config = mergeConfigs(baseFormat, format);

    // apply command line arguments

    // --no-execute-code
    if (flags?.execute !== undefined) {
      config.execution[kExecute] = flags?.execute;
    }

    // --cache
    if (flags?.executeCache !== undefined) {
      config.execution[kCache] = flags?.executeCache;
    }

    // --kernel-keepalive
    if (flags?.kernelKeepalive !== undefined) {
      config.execution[kKernelKeepalive] = flags.kernelKeepalive;
    }

    // --kernel-restart
    if (flags?.kernelRestart !== undefined) {
      config.execution[kKernelRestart] = flags.kernelRestart;
    }

    // --kernel-debug
    if (flags?.kernelDebug !== undefined) {
      config.execution[kKernelDebug] = flags.kernelDebug;
    }

    resolved[to] = config;
  });

  return resolved;
}
