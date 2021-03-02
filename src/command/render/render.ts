/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { createSessionTempDir } from "../../core/temp.ts";

import {
  formatFromMetadata,
  includedMetadata,
  Metadata,
  metadataAsFormat,
} from "../../config/metadata.ts";
import {
  kBibliography,
  kCache,
  kCss,
  kExecute,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepMd,
  kKernelDebug,
  kKernelKeepalive,
  kKernelRestart,
  kMetadataFile,
  kMetadataFiles,
  kMetadataFormat,
  kSelfContained,
} from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  executionEngine,
  ExecutionTarget,
} from "../../execute/engine.ts";

import { pandocMetadataPath, PandocOptions, runPandoc } from "./pandoc.ts";
import { removePandocToArg, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import {
  kLibDir,
  ProjectContext,
  projectContext,
} from "../../project/project-context.ts";
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
  libDir?: string;
}

export interface RenderResourceFiles {
  globs: string[];
  files: string[];
}

export interface RenderResult {
  input: string;
  file: string;
  filesDir?: string;
  resourceFiles: RenderResourceFiles;
  selfContained: boolean;
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
        selfContained: pandocResult.selfContained,
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

  // see if there is a libDir
  let libDir = project?.metadata?.project?.[kLibDir];
  if (project && libDir) {
    libDir = relative(".", join(project.dir, libDir));
  }

  // return contexts
  const contexts: Record<string, RenderContext> = {};
  Object.keys(formats).forEach((format: string) => {
    contexts[format] = {
      target,
      options,
      engine,
      format: formats[format],
      project,
      libDir,
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
    tempDir: createSessionTempDir(),
    dependencies: resolveDependencies,
    libDir: context.libDir,
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

// result of pandoc render
export interface PandocResult {
  finalOutput: string;
  resourceFiles: RenderResourceFiles;
  selfContained: boolean;
}

export async function renderPandoc(
  context: RenderContext,
  executeResult: ExecuteResult,
): Promise<PandocResult> {
  // merge any pandoc options provided by the computation
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
      tempDir: createSessionTempDir(),
      libDir: context.libDir,
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
    project: context.project,
    args: recipe.args,
    flags: context.options.flags,
  };

  // add offset if we are in a project
  if (context.project) {
    const projDir = Deno.realPathSync(context.project.dir);
    const inputDir = Deno.realPathSync(dirname(context.target.input));
    const offset = relative(inputDir, projDir) || ".";
    pandocOptions.offset = pandocMetadataPath(offset);
  }

  // run pandoc conversion (exit on failure)
  const resourceFiles = await runPandoc(pandocOptions, executeResult.filters);
  if (!resourceFiles) {
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

  // ensure flags
  const flags = context.options.flags || {};

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // determine whether this is self-contained output
  const selfContained = isSelfContainedOutput(
    flags,
    context.format,
    finalOutput,
  );

  cleanup(
    selfContained,
    context.format,
    finalOutput,
    executeResult.supporting,
    context.engine.keepMd(context.target.input),
  );

  // return result
  return {
    finalOutput,
    resourceFiles,
    selfContained,
  };
}

function isSelfContainedOutput(
  flags: RenderFlags,
  format: Format,
  finalOutput: string,
) {
  // some extensions are 'known' to be standalone/self-contained
  // see https://pandoc.org/MANUAL.html#option--standalone
  const kStandaloneExtensions = [
    ".pdf",
    ".epub",
    ".fb2",
    ".docx",
    ".rtf",
    ".pptx",
    ".odt",
    ".ipynb",
  ];

  // determine if we will be self contained
  const selfContained = flags[kSelfContained] ||
    (format.pandoc && format.pandoc[kSelfContained]) ||
    kStandaloneExtensions.includes(extname(finalOutput));

  return selfContained;
}

async function resolveFormats(
  target: ExecutionTarget,
  engine: ExecutionEngine,
  flags?: RenderFlags,
): Promise<Record<string, Format>> {
  // merge input metadata into project metadata
  const projMetadata = projectMetadataForInputFile(target.input);
  const inputMetadata = await engine.metadata(target.input);
  const baseMetadata = mergeQuartoConfigs(
    projMetadata,
    inputMetadata,
  );

  // Read any included metadata files and merge in and metadata from the command
  const includeMetadata = includedMetadata(dirname(target.input), baseMetadata);
  const allMetadata = mergeQuartoConfigs(
    baseMetadata,
    includeMetadata,
    flags?.metadata || {},
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

function projectMetadataForInputFile(input: string): Metadata {
  const context = projectContext(input);
  const projMetadata = context.metadata || {};

  const fixupPaths = (collection: Array<unknown> | Record<string, unknown>) => {
    ld.forEach(
      collection,
      (
        value: unknown,
        index: unknown,
        collection: Array<unknown> | Record<string, unknown>,
      ) => {
        const assign = (value: unknown) => {
          if (typeof (index) === "number") {
            (collection as Array<unknown>)[index] = value;
          } else if (typeof (index) === "string") {
            (collection as Record<string, unknown>)[index] = value;
          }
        };

        if (Array.isArray(value)) {
          assign(fixupPaths(value));
        } else if (typeof (value) === "object") {
          assign(fixupPaths(value as Record<string, unknown>));
        } else if (typeof (value) === "string") {
          if (!isAbsolute(value)) {
            // if this is a valid file, then transform it to be relative to the input path
            const projectPath = join(context.dir, value);
            if (existsSync(projectPath)) {
              const offset = relative(dirname(input), context.dir);
              assign(join(offset, value));
            }
          }
        }
      },
    );
    return collection;
  };

  return fixupPaths(projMetadata) as Metadata;
}

function mergeQuartoConfigs(
  config: Metadata,
  ...configs: Array<Metadata>
): Metadata {
  // copy all configs so we don't mutate them
  config = ld.cloneDeep(config);
  configs = ld.cloneDeep(configs);

  // bibliography needs to always be an array so it can be merged
  const fixupMergeableScalars = (metadata: Metadata) => {
    [
      kBibliography,
      kCss,
      kHeaderIncludes,
      kIncludeBefore,
      kIncludeAfter,
      kIncludeInHeader,
      kIncludeBeforeBody,
      kIncludeAfterBody,
    ]
      .forEach((key) => {
        if (typeof (metadata[key]) === "string") {
          metadata[key] = [metadata[key]];
        }
      });
  };

  // formats need to always be objects
  const fixupFormat = (config: Record<string, unknown>) => {
    const format = config[kMetadataFormat];
    if (typeof (format) === "string") {
      config.format = { [format]: {} };
    } else if (format instanceof Object) {
      Object.keys(format).forEach((key) => {
        if (typeof (Reflect.get(format, key)) !== "object") {
          Reflect.set(format, key, {});
        }
        fixupMergeableScalars(Reflect.get(format, key) as Metadata);
      });
    }
    fixupMergeableScalars(config);
    return config;
  };

  return mergeConfigs(
    fixupFormat(config),
    ...configs.map((c) => fixupFormat(c)),
  );
}
