/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { basename, dirname, extname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { info } from "log/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { createSessionTempDir } from "../../core/temp.ts";
import { inputFilesDir } from "../../core/render.ts";
import { dirAndStem } from "../../core/path.ts";

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
  kFreeze,
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
  kMetadataFormat,
  kOutputExt,
  kOutputFile,
  kSelfContained,
  kTheme,
} from "../../config/constants.ts";
import { Format, FormatPandoc } from "../../config/format.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  fileExecutionEngine,
  PandocIncludes,
} from "../../execute/engine.ts";

import { defaultWriterFormat } from "../../format/formats.ts";

import { formatHasBootstrap } from "../../format/html/format-html-bootstrap.ts";

import { PandocOptions, runPandoc } from "./pandoc.ts";
import { removePandocToArg, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { OutputRecipe, outputRecipe } from "./output.ts";
import {
  deleteProjectMetadata,
  kLibDir,
  ProjectContext,
  projectContext,
  projectMetadataForInputFile,
  projectOffset,
} from "../../project/project-context.ts";

import { renderProject } from "./project.ts";
import {
  copyFromProjectFreezer,
  defrostExecuteResult,
  freezeExecuteResult,
} from "./freeze.ts";

// options for render
export interface RenderOptions {
  flags?: RenderFlags;
  pandocArgs?: string[];
  useFreezer?: boolean;
}

// context for render
export interface RenderContext {
  target: ExecutionTarget;
  options: RenderOptions;
  engine: ExecutionEngine;
  format: Format;
  libDir: string;
  project?: ProjectContext;
}

export interface RenderResourceFiles {
  globs: string[];
  files: string[];
}

export interface RenderResult {
  baseDir?: string;
  outputDir?: string;
  files: RenderResultFile[];
  error?: Error;
}

export interface RenderResultFile {
  input: string;
  markdown: string;
  format: Format;
  file: string;
  filesDir?: string;
  resourceFiles: string[];
}

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // determine target context/files
  const context = projectContext(path);

  if (Deno.statSync(path).isDirectory) {
    // all directories are considered projects
    return renderProject(
      context,
      options,
    );
  } else if (context.metadata) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    const renderPath = Deno.realPathSync(path);
    if (
      context.files.input.map((file) => Deno.realPathSync(file)).includes(
        renderPath,
      )
    ) {
      return renderProject(context, options, [path]);
    }
  }

  // otherwise it's just a file render
  const result = await renderFiles([path], options);
  return {
    files: Object.keys(result.files).flatMap((key) => {
      return result.files[key].map((result) => ({
        input: result.input,
        markdown: result.markdown,
        format: result.format,
        file: result.file,
        filesDir: result.filesDir,
        resourceFiles: [],
      }));
    }),
    error: result.error,
  };
}

export interface RenderedFile {
  input: string;
  markdown: string;
  format: Format;
  file: string;
  filesDir?: string;
  resourceFiles: RenderResourceFiles;
  selfContained: boolean;
}

export interface PandocRenderer {
  onRender: (file: ExecutedFile) => Promise<void>;
  onComplete: () => Promise<Record<string, RenderedFile[]>>;
  onError: () => void;
}

export interface RenderFilesResult {
  files: Record<string, RenderedFile[]>;
  error?: Error;
}

export async function renderFiles(
  files: string[],
  options: RenderOptions,
  pandocRenderer?: PandocRenderer,
  project?: ProjectContext,
  alwaysExecute?: boolean,
): Promise<RenderFilesResult> {
  // provide default renderer
  pandocRenderer = pandocRenderer || defaultPandocRenderer();

  try {
    // make a copy of options so we don't mutate caller context
    options = ld.cloneDeep(options);

    // kernel keepalive default of 5 mintues for interactive sessions
    if (options.flags && options.flags.kernelKeepalive === undefined) {
      const isInteractive = Deno.isatty(Deno.stderr.rid) ||
        !!Deno.env.get("RSTUDIO_VERSION");
      if (isInteractive) {
        options.flags.kernelKeepalive = 300;
      } else {
        options.flags.kernelKeepalive = 0;
      }
    }

    // see if we should be using file-by-file progress
    const progress = project && (files.length > 1) && !options.flags?.quiet;

    if (progress) {
      info(`\nRendering project:`);
      options.flags = options.flags || {};
      options.flags.quiet = true;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (progress) {
        info(relative(project!.dir, file), { indent: 2 });
      }

      // make a copy of options (since we mutate it)
      const fileOptions = ld.cloneDeep(options) as RenderOptions;

      // get contexts
      const contexts = await renderContexts(
        file,
        fileOptions,
        project,
      );

      // remove --to (it's been resolved into contexts)
      delete fileOptions.flags?.to;
      if (fileOptions.pandocArgs) {
        fileOptions.pandocArgs = removePandocToArg(fileOptions.pandocArgs);
      }

      for (const context of Object.values(contexts)) {
        // get output recipe
        const recipe = await outputRecipe(context);

        // execute
        const executeResult = await renderExecute(
          context,
          recipe.output,
          true,
          alwaysExecute,
        );

        // callback
        await pandocRenderer.onRender({ context, recipe, executeResult });
      }
    }

    return {
      files: await pandocRenderer.onComplete(),
    };
  } catch (error) {
    // call error handler if we have one
    pandocRenderer?.onError();

    // return result with error
    return {
      files: await pandocRenderer.onComplete(),
      error: error || new Error(),
    };
  }
}

export async function renderContexts(
  file: string,
  options: RenderOptions,
  project?: ProjectContext,
): Promise<Record<string, RenderContext>> {
  // determine the computation engine and any alternate input file
  const engine = await fileExecutionEngine(file);
  if (!engine) {
    throw new Error("Unable to render " + file);
  }

  const target = await engine.target(file, options.flags?.quiet);
  if (!target) {
    throw new Error("Unable to render " + file);
  }

  // resolve render target
  const formats = await resolveFormats(target, engine, options.flags, project);

  // see if there is a libDir
  let libDir = project?.metadata?.project?.[kLibDir];
  if (project && libDir) {
    libDir = relative(dirname(file), join(project.dir, libDir));
  } else {
    libDir = filesDirLibDir(file);
  }

  // return contexts
  const contexts: Record<string, RenderContext> = {};
  Object.keys(formats).forEach((format: string) => {
    // set format
    contexts[format] = {
      target,
      options,
      engine,
      format: formats[format],
      project,
      libDir: libDir!,
    };
  });
  return contexts;
}

export async function renderFormats(
  file: string,
  to = "all",
  project?: ProjectContext,
): Promise<Record<string, Format>> {
  const contexts = await renderContexts(file, { flags: { to } }, project);
  const formats: Record<string, Format> = {};
  Object.keys(contexts).forEach((context) => {
    // get the format
    const format = contexts[context].format;
    // remove other formats
    delete format.metadata.format;
    // remove project level metadata
    deleteProjectMetadata(format.metadata);
    // resolve output-file
    if (!format.pandoc[kOutputFile]) {
      const [_dir, stem] = dirAndStem(file);
      format.pandoc[kOutputFile] = `${stem}.${format.render[kOutputExt]}`;
    }
    formats[context] = format;
  });
  return formats;
}

export async function renderExecute(
  context: RenderContext,
  output: string,
  resolveDependencies: boolean,
  alwaysExecute?: boolean,
): Promise<ExecuteResult> {
  // alias flags
  const flags = context.options.flags || {};

  // use previous frozen results if they are available
  if (context.project && !alwaysExecute) {
    // check if the user has enabled freeze
    let thaw = context.format.execution[kFreeze];

    // if the user hasn't enable freeze explicitly, we still might need to
    // do it useFreezer was specified (e.g. for the dev server)
    if (context.options.useFreezer) {
      const inputDir = relative(
        context.project.dir,
        dirname(context.target.source),
      );
      const filesDir = join(inputDir, inputFilesDir(context.target.source));
      copyFromProjectFreezer(context.project, filesDir);
      thaw = "auto";
    }

    if (thaw) {
      const thawedResult = defrostExecuteResult(
        context.target.source,
        output,
        thaw === true,
      );
      if (thawedResult) {
        return thawedResult;
      }
    }
  }

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

  // write the freeze file if we are in a project
  if (context.project) {
    freezeExecuteResult(context.target.source, output, executeResult);
  }

  // return result
  return executeResult;
}

export interface ExecutedFile {
  context: RenderContext;
  recipe: OutputRecipe;
  executeResult: ExecuteResult;
}

export async function renderPandoc(
  file: ExecutedFile,
): Promise<RenderedFile> {
  // alias options
  const { context, recipe, executeResult } = file;

  // alias format
  const format = recipe.format;

  // merge any pandoc options provided by the computation
  format.pandoc = mergePandocIncludes(
    format.pandoc || {},
    executeResult.includes,
  );

  // run the dependencies step if we didn't do it during execution
  if (executeResult.dependencies) {
    const dependenciesResult = await context.engine.dependencies({
      target: context.target,
      format,
      output: recipe.output,
      resourceDir: resourcePath(),
      tempDir: createSessionTempDir(),
      libDir: context.libDir,
      dependencies: [executeResult.dependencies],
      quiet: context.options.flags?.quiet,
    });
    format.pandoc = mergePandocIncludes(
      format.pandoc,
      dependenciesResult.includes,
    );
  }

  // pandoc options
  const pandocOptions: PandocOptions = {
    markdown: executeResult.markdown,
    input: context.target.input,
    output: recipe.output,
    libDir: context.libDir,
    format,
    project: context.project,
    args: recipe.args,
    flags: context.options.flags,
  };

  // add offset if we are in a project
  if (context.project) {
    pandocOptions.offset = projectOffset(context.project, context.target.input);
  }

  // run pandoc conversion (exit on failure)
  const resourceFiles = await runPandoc(pandocOptions, executeResult.filters);
  if (!resourceFiles) {
    return Promise.reject();
  }

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (
    executeResult.preserve && (Object.keys(executeResult.preserve).length > 0)
  ) {
    await context.engine.postprocess({
      engine: context.engine,
      target: context.target,
      format,
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
    format,
    finalOutput,
  );

  // determine supporting files
  const supporting = executeResult.supporting;
  const libDir = join(
    dirname(context.target.input),
    filesDirLibDir(context.target.input),
  );
  if (existsSync(libDir)) {
    supporting.push(Deno.realPathSync(libDir));
  }

  cleanup(
    selfContained,
    format,
    finalOutput,
    supporting,
    context.engine.keepMd(context.target.input),
  );

  // determine if we have a files dir
  const relativeFilesDir = inputFilesDir(context.target.source);
  const filesDir =
    existsSync(join(dirname(context.target.source), relativeFilesDir))
      ? relativeFilesDir
      : undefined;

  // if there is a project context then return paths relative to the project
  const projectPath = (path: string) => {
    if (context.project) {
      return relative(
        Deno.realPathSync(context.project.dir),
        Deno.realPathSync(join(dirname(context.target.source), basename(path))),
      );
    } else {
      return path;
    }
  };

  return {
    input: projectPath(context.target.source),
    markdown: executeResult.markdown,
    format: context.format,
    filesDir: filesDir ? projectPath(filesDir) : undefined,

    file: projectPath(finalOutput),
    resourceFiles: resourceFiles,
    selfContained: selfContained,
  };
}

export function renderResultFinalOutput(
  renderResults: RenderResult,
  relativeToInput = false,
) {
  // final output defaults to the first output of the first result
  let result = renderResults.files[0];
  if (!result) {
    return undefined;
  }

  // see if we can find an index.html instead
  for (const fileResult of renderResults.files) {
    if (fileResult.file === "index.html") {
      result = fileResult;
      break;
    }
  }

  // determine final output
  let finalInput = result.input;
  let finalOutput = result.file;

  if (renderResults.baseDir) {
    finalInput = join(renderResults.baseDir, finalInput);
    if (renderResults.outputDir) {
      finalOutput = join(
        renderResults.baseDir,
        renderResults.outputDir,
        finalOutput,
      );
    } else {
      finalOutput = join(renderResults.baseDir, finalOutput);
    }
  } else {
    finalOutput = join(dirname(finalInput), finalOutput);
  }

  // return a path relative to the input file
  if (relativeToInput) {
    const inputRealPath = Deno.realPathSync(finalInput);
    const outputRealPath = Deno.realPathSync(finalOutput);
    return relative(dirname(inputRealPath), outputRealPath);
  } else {
    return finalOutput;
  }
}

// default pandoc renderer immediately renders each execution result
function defaultPandocRenderer(): PandocRenderer {
  const results: Record<string, RenderedFile[]> = {};

  return {
    onRender: async (executedFile: ExecutedFile) => {
      const source = executedFile.context.target.source;
      results[source] = results[source] || [];
      results[source].push(await renderPandoc(executedFile));
    },
    onComplete: () => {
      return Promise.resolve(results);
    },
    onError: () => {
    },
  };
}

function mergePandocIncludes(
  format: FormatPandoc,
  pandocIncludes: PandocIncludes,
) {
  const includesFormat: FormatPandoc = {};
  const mergeIncludes = (
    name: "include-in-header" | "include-before-body" | "include-after-body",
  ) => {
    if (pandocIncludes[name]) {
      includesFormat[name] = [pandocIncludes[name]!];
    }
  };
  mergeIncludes(kIncludeInHeader);
  mergeIncludes(kIncludeBeforeBody);
  mergeIncludes(kIncludeAfterBody);
  return mergeConfigs(format, includesFormat);
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

export function resolveFormatsFromMetadata(
  metadata: Metadata,
  includeDir: string,
  formats?: string[],
  flags?: RenderFlags,
): Record<string, Format> {
  // Read any included metadata files and merge in and metadata from the command
  const included = includedMetadata(includeDir, metadata);
  const allMetadata = mergeQuartoConfigs(
    metadata,
    included.metadata,
    flags?.metadata || {},
  );

  // divide allMetadata into format buckets
  const baseFormat = metadataAsFormat(allMetadata);

  if (formats === undefined) {
    formats = formatKeys(allMetadata);
  }

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

async function resolveFormats(
  target: ExecutionTarget,
  engine: ExecutionEngine,
  flags?: RenderFlags,
  project?: ProjectContext,
): Promise<Record<string, Format>> {
  // merge input metadata into project metadata
  const projMetadata = projectMetadataForInputFile(target.input, project);
  const inputMetadata = await engine.metadata(target.input);

  // determine order of formats
  const formats = ld.uniq(
    formatKeys(inputMetadata).concat(formatKeys(projMetadata)),
  );

  // resolve formats for proj and input
  const projFormats = resolveFormatsFromMetadata(
    projMetadata,
    dirname(target.input),
    formats,
    flags,
  );

  const inputFormats = resolveFormatsFromMetadata(
    inputMetadata,
    dirname(target.input),
    formats,
    flags,
  );

  // merge the formats
  const targetFormats = ld.uniq(
    Object.keys(projFormats).concat(Object.keys(inputFormats)),
  );
  const mergedFormats: Record<string, Format> = {};
  targetFormats.forEach((format) => {
    // alias formats
    const projFormat = projFormats[format];
    const inputFormat = inputFormats[format];

    // resolve theme (project-level bootstrap theme always wins)
    if (project && formatHasBootstrap(projFormat)) {
      if (formatHasBootstrap(inputFormat)) {
        delete inputFormat.metadata[kTheme];
      } else {
        delete projFormat.metadata[kTheme];
      }
    }

    // do the merge
    mergedFormats[format] = mergeConfigs(
      defaultWriterFormat(format),
      projFormat || {},
      inputFormat || {},
    );
  });

  return mergedFormats;
}

// determine all target formats (use original input and
// project metadata to preserve order of keys and to
// prefer input-level format keys to project-level)
function formatKeys(metadata: Metadata): string[] {
  if (typeof metadata[kMetadataFormat] === "string") {
    return [metadata[kMetadataFormat] as string];
  } else if (metadata[kMetadataFormat] instanceof Object) {
    return Object.keys(metadata[kMetadataFormat] as Metadata);
  } else {
    return [];
  }
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

function filesDirLibDir(input: string) {
  return join(inputFilesDir(input), "libs");
}
