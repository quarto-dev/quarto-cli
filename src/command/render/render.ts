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
import { readYaml, readYamlFromMarkdownFile } from "../../core/yaml.ts";

import {
  fileMetadata,
  formatFromMetadata,
  Metadata,
  projectMetadata,
} from "../../config/metadata.ts";

import { computeEngineForFile } from "../../computation/engine.ts";

import { postProcess as postprocess, runComputations } from "./computation.ts";
import { runPandoc } from "./pandoc.ts";
import { kStdOut, RenderFlags, resolveParams } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";

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
  const { input, metadata, format } = await resolveTarget(options);

  // derive the pandoc input file path (computations will create this)
  const [inputDir, inputStem] = dirAndStem(input);
  const mdInput = join(inputDir, inputStem + ".md");

  // run computations
  const computations = await runComputations({
    input,
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
    metadata,
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
      input,
      format,
      output: recipe.output,
      data: computations.postprocess,
      quiet: flags.quiet,
    });
  }

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as required
  cleanup(input, flags, format, computations, finalOutput);

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    message("Output created: " + finalOutput + "\n");
  }

  // return result
  return result;
}

async function resolveTarget(options: RenderOptions) {
  const input = options.input;
  const override = options.flags?.metadataOverride;

  // merge input metadata into project metadata
  const inputMetadata = await fileMetadata(input, override);
  const projMetadata = projectMetadata(input);
  const baseMetadata = mergeConfigs(projMetadata, inputMetadata);

  // determine which writer to use (use original input and
  // project metadata to preserve order of keys and to
  // prefer input-level format keys to project-level)
  let to = options.flags?.to;
  if (!to) {
    to = "html";
    const formats = Object.keys(inputMetadata).concat(
      Object.keys(projectMetadata),
    );
    if (formats.length > 0) {
      to = formats[0];
    }
  }

  // determine the target format
  const format = formatFromMetadata(baseMetadata, to, options.flags?.debug);

  // merge pandoc metadata within the format into the base metadata
  // found within the input file and any project file(s)
  const metadata = mergeConfigs(baseMetadata, format.metadata || {});

  // return target
  return {
    input,
    metadata,
    format,
  };
}
