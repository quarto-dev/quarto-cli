/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname } from "path/mod.ts";

import { message } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
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
} from "../../execute/engine.ts";

import { runPandoc } from "./pandoc.ts";
import {
  kStdOut,
  removePandocArgs,
  removePandocToArg,
  RenderFlags,
  resolveParams,
} from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { projectMetadata } from "../../config/project.ts";

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
}

export async function render(
  file: string,
  options: RenderOptions,
): Promise<ProcessResult> {
  // get contexts
  const contexts = await renderContexts(file, options);

  // remove --to (it's been resolved into contexts)
  delete options.flags?.to;
  if (options.pandocArgs) {
    options.pandocArgs = removePandocToArg(options.pandocArgs);
  }

  for (const context of Object.values(contexts)) {
    // execute
    const executeResult = await renderExecute(context, true);

    // run pandoc
    const result = await renderPandoc(context, executeResult);
    if (!result.success) {
      return result;
    }
  }

  return { success: true, code: 0 };
}

export async function renderContexts(
  file: string,
  options: RenderOptions,
): Promise<Record<string, RenderContext>> {
  // determine the computation engine and any alternate input file
  const { target, engine } = await executionEngine(file, options.flags?.quiet);

  // resolve render target
  const formats = await resolveFormat(target, engine, options.flags);

  // return contexts
  const contexts: Record<string, RenderContext> = {};
  Object.keys(formats).forEach((format) => {
    contexts[format] = {
      target,
      options,
      engine,
      format: formats[format],
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
    params: resolveParams(flags.executeParams),
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
): Promise<ProcessResult> {
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
  const pandocOptions = {
    markdown: executeResult.markdown,
    cwd: dirname(context.target.input),
    format: recipe.format,
    args: recipe.args,
    flags: context.options.flags,
  };

  // run pandoc conversion (exit on failure)
  const pandocResult = await runPandoc(pandocOptions, executeResult.filters);
  if (!pandocResult.success) {
    return pandocResult;
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

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    message("Output created: " + finalOutput + "\n");
  }

  // return result
  return pandocResult;
}

async function resolveFormat(
  target: ExecutionTarget,
  engine: ExecutionEngine,
  flags?: RenderFlags,
): Promise<Record<string, Format>> {
  // merge input metadata into project metadata
  const inputMetadata = await engine.metadata(target);
  const projMetadata = projectMetadata(target.input);
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
    if (flags?.to === "all") {
      renderFormats.push(...formats);
    } else {
      renderFormats.push(flags?.to);
    }
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
    if (flags?.execute === false) {
      config.execution[kExecute] = false;
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
