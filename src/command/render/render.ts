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
import { readYaml } from "../../core/yaml.ts";

import {
  fileMetadata,
  formatFromMetadata,
  Metadata,
  metadataAsFormat,
  projectMetadata,
} from "../../config/metadata.ts";

import { postProcess as postprocess, runComputations } from "./computation.ts";
import { runPandoc } from "./pandoc.ts";
import { kStdOut, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { kMetadataFormat } from "../../config/constants.ts";

// command line options for render
export interface RenderOptions {
  input: string;
  flags?: RenderFlags;
  pandocArgs?: string[];
}

export async function render(options: RenderOptions): Promise<ProcessResult> {
  // alias flags
  const flags = options.flags || {};

  // resolve render target
  const format = await resolveFormat(options);

  // derive the pandoc input file path (computations will create this)
  const [inputDir, inputStem] = dirAndStem(options.input);
  const mdInput = join(inputDir, inputStem + ".md");

  // run computations
  const computations = await runComputations({
    input: options.input,
    output: mdInput,
    format,
    cwd: flags.computeDir,
    params: resolveParams(flags.computeParams),
    quiet: flags.quiet,
  });

  // merge any pandoc options provided the computation
  format.pandoc = mergeConfigs(format.pandoc || {}, computations.pandoc);

  // pandoc output recipe (target file, args, complete handler)
  const recipe = outputRecipe(options, mdInput, format);

  // pandoc options
  const pandocOptions = {
    input: mdInput,
    format: recipe.format,
    args: recipe.args,
    flags: options.flags,
  };

  // run pandoc conversion (exit on failure)
  const result = await runPandoc(pandocOptions);
  if (!result.success) {
    return result;
  }

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (computations.postprocess) {
    await postprocess({
      input: options.input,
      format,
      output: recipe.output,
      data: computations.postprocess,
      quiet: flags.quiet,
    });
  }

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as required
  cleanup(options.input, flags, format, computations, finalOutput);

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    message("Output created: " + finalOutput + "\n");
  }

  // return result
  return result;
}

async function resolveFormat(options: RenderOptions) {
  // merge input metadata into project metadata
  const inputMetadata = await fileMetadata(options.input);
  const projMetadata = projectMetadata(options.input);
  const baseMetadata = mergeConfigs(projMetadata, inputMetadata);

  // divide metadata into format buckets
  const baseFormat = metadataAsFormat(baseMetadata);

  // determine which writer to use (use original input and
  // project metadata to preserve order of keys and to
  // prefer input-level format keys to project-level)
  let to = options.flags?.to;
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
    baseFormat.metadata || {},
    to,
    options.flags?.debug,
  );

  // return target
  return mergeConfigs(baseFormat, format);
}
