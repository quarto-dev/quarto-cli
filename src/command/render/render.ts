/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { message } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
import { dirAndStem } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { sessionTempDir } from "../../core/temp.ts";

import {
  formatFromMetadata,
  includedMetadata,
  Metadata,
  metadataAsFormat,
  projectMetadata,
} from "../../config/metadata.ts";

import { runPandoc } from "./pandoc.ts";
import { kStdOut, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
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
import {
  ExecutionEngine,
  executionEngine,
  ExecutionTarget,
} from "../../execute/engine.ts";

// command line options for render
export interface RenderOptions {
  flags?: RenderFlags;
  pandocArgs?: string[];
}

export async function render(
  file: string,
  options: RenderOptions,
): Promise<ProcessResult> {
  // alias flags
  const flags = options.flags || {};

  // determine the computation engine and any alternate input file
  const { target, engine } = await executionEngine(file, flags.quiet);

  // resolve render target
  const format = await resolveFormat(target, engine, options.flags);

  // derive the pandoc input file path (computations will create this)
  const [inputDir, inputStem] = dirAndStem(target.input);
  const mdOutput = join(inputDir, `${inputStem}.${engine.name}-md`);

  // should we resolve dependencies immediatley
  const dependencies = true;

  // execute computations
  const tempDir = sessionTempDir();
  const executeResult = await engine.execute({
    target,
    output: mdOutput,
    resourceDir: resourcePath(),
    tempDir,
    dependencies,
    format,
    cwd: flags.executeDir,
    params: resolveParams(flags.executeParams),
    quiet: flags.quiet,
  });

  // keep md if requested
  const keepMd = engine.keepMd(target.input);
  if (keepMd && format.render[kKeepMd]) {
    Deno.copyFileSync(mdOutput, keepMd);
  }

  // merge any pandoc options provided the computation
  format.pandoc = mergeConfigs(format.pandoc || {}, executeResult.pandoc);

  // pandoc output recipe (target file, args, complete handler)
  const recipe = await outputRecipe(file, options, format, engine);

  // run the dependencies step if we didn't do it during execution
  if (!dependencies) {
    const dependenciesResult = await engine.dependencies({
      target,
      format,
      output: recipe.output,
      resourceDir: resourcePath(),
      tempDir,
      libDir: undefined, // TODO
      dependencies: [executeResult.dependencies],
      quiet: flags.quiet,
    });
    recipe.format.pandoc = mergeConfigs(
      recipe.format.pandoc,
      dependenciesResult.pandoc,
    );
  }

  // pandoc options
  const pandocOptions = {
    input: mdOutput,
    format: recipe.format,
    args: recipe.args,
    flags: options.flags,
  };

  // run pandoc conversion (exit on failure)
  const pandocResult = await runPandoc(pandocOptions, executeResult.filters);
  if (!pandocResult.success) {
    return pandocResult;
  }

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (executeResult.preserve && engine.postprocess) {
    await engine.postprocess({
      engine,
      target,
      format,
      output: recipe.output,
      preserve: executeResult.preserve,
      quiet: flags.quiet,
    });
  }

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as required
  cleanup(
    flags,
    format,
    mdOutput,
    finalOutput,
    executeResult.supporting,
    engine.keepMd(target.input),
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
) {
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

  // determine which writer to use (use original input and
  // project metadata to preserve order of keys and to
  // prefer input-level format keys to project-level)
  let to = flags?.to;
  if (!to) {
    // see if there is a 'to' or 'writer' specified in defaults
    to = baseFormat.pandoc.to || baseFormat.pandoc.writer || "html";
    to = to.split("+")[0];
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
    if (formats.length > 0) {
      to = formats[0];
    }
  }

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

  // return
  return config;
}
