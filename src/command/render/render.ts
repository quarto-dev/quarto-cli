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
  formatFromMetadata,
  Metadata,
  projectMetadata,
} from "../../config/metadata.ts";

import { computationEngineForFile } from "../../computation/engine.ts";

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

  // resolve metadata and 'to' target
  const { metadata, to } = await resolveTarget(options);

  // determine the format
  const format = formatFromMetadata(metadata, to, flags.debug);

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

async function resolveTarget(options: RenderOptions) {
  const input = options.input;
  const override = options.flags?.metadataOverride;

  // look for a 'project' _quarto.yml
  const projMetadata: Metadata = projectMetadata(input);

  // get metadata from computational preprocessor (or from the raw .md)
  const engine = computationEngineForFile(input);
  let inputMetadata = engine
    ? await engine.metadata(input)
    : readYamlFromMarkdownFile(input);

  // merge in any options provided via override file
  if (override) {
    inputMetadata = mergeConfigs(
      inputMetadata,
      readYaml(override) as Metadata,
    );
  }

  // determine which writer to use
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

  // derive quarto config from merge of project config into file config
  const metadata = mergeConfigs(projMetadata, inputMetadata);

  return {
    metadata,
    to,
  };
}
