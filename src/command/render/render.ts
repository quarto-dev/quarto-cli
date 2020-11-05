/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { join } from "path/mod.ts";

import { message } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
import { dirAndStem } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";

import {
  formatFromMetadata,
  Metadata,
  metadataAsFormat,
  projectMetadata,
} from "../../config/metadata.ts";

import { runPandoc } from "./pandoc.ts";
import { kStdOut, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { kMetadataFormat } from "../../config/constants.ts";
import { ExecutionEngine, executionEngine } from "../../execute/engine.ts";

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

  // create a tempDir to be used during computations
  const tempDir = await Deno.makeTempDir({ prefix: "quarto" });

  // determine the computation engine and any alternate input file
  const { input, engine } = await executionEngine(file, flags.quiet);

  // resolve render target
  const format = await resolveFormat(input, engine, options.flags);

  // derive the pandoc input file path (computations will create this)
  const [inputDir, inputStem] = dirAndStem(input);
  const mdOutput = join(inputDir, inputStem + ".quarto.md");

  // execute computations
  const executeResult = await engine.execute({
    input,
    output: mdOutput,
    tempDir,
    resourceDir: resourcePath(),
    format,
    cwd: flags.executeDir,
    params: resolveParams(flags.executeParams),
    quiet: flags.quiet,
  });

  // merge any pandoc options provided the computation
  format.pandoc = mergeConfigs(format.pandoc || {}, executeResult.pandoc);

  // pandoc output recipe (target file, args, complete handler)
  const recipe = outputRecipe(file, options, format, engine);

  // pandoc options
  const pandocOptions = {
    input: mdOutput,
    format: recipe.format,
    args: recipe.args,
    flags: options.flags,
  };

  // run pandoc conversion (exit on failure)
  const pandocResult = await runPandoc(pandocOptions);
  if (!pandocResult.success) {
    return pandocResult;
  }

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (executeResult.postprocess && engine.postprocess) {
    await engine.postprocess({
      engine,
      input,
      format,
      output: recipe.output,
      data: executeResult.postprocess,
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
    tempDir,
    engine.keepMd(input),
  );

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    message("Output created: " + finalOutput + "\n");
  }

  // return result
  return pandocResult;
}

async function resolveFormat(
  input: string,
  engine: ExecutionEngine,
  flags?: RenderFlags,
) {
  // merge input metadata into project metadata
  const inputMetadata = await engine.metadata(input);
  const projMetadata = projectMetadata(input);
  const baseMetadata = mergeConfigs(projMetadata, inputMetadata);

  // divide metadata into format buckets
  const baseFormat = metadataAsFormat(baseMetadata);

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

  // return target
  return mergeConfigs(baseFormat, format);
}
