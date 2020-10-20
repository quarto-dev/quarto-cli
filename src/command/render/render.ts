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

import { consoleWriteLine } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
import { readYAML } from "../../core/yaml.ts";
import { dirAndStem } from "../../core/path.ts";

import { mergeConfigs } from "../../config/config.ts";
import { formatForInputFile } from "../../config/format.ts";

import { postProcess as postprocess, runComputations } from "./computation.ts";
import { runPandoc } from "./pandoc.ts";
import { kStdOut, RenderFlags } from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";

// TODO: experiment with --compute-dir and _files (in both rmarkdown and quarto)

// TODO: support for -output-directory (option and/or do it by default)

// TODO: support tinytex: false, crossref: false (citeproc: false)

// TODO: targeting markdown to markdown. we need to account for:
//    - specifying the active mardkown extensions
//    - using a .md as the output extension *unless* it's markdown to markdown

// TODO: discover index.Rmd or ui.Rmd for quarto run

// TODO: make options top level
///   fig-width,
//    fig-height,
//    keep-md,
//    keep-tex,
//    show-code,
//    show-warning,
//    output-ext
// compatible w/ existing pandoc args / config
// schema, compatible w/ command line

// TODO: new config system
// TODO: fill out all the pandoc formats

// TODO: memo/proposal on _quarto directory
//    _quarto
//       .gitignore
//       _quarto.yml
//       _quarto.lock
//       snapshot/

// TODO: memo/proposal on computations:
// will be able to use RStudio chunk output and/or notebook for compute?
// or perhaps require html_notebook?
// computations could even be at a URL!!!

/*
    {{= notebook.ipynb#visualization =}}
    {{< computation notebook.Rmd#chunk-label >}}

    {{< figure projections.xlsx#chunk-label caption="asfdasdf" label="" >}}

    {{< table projections.xlsx#fy-2019 >}}

    {{< text notebook.Rmd##chunk-label >}}

    {{< tweet https://twitter.com/foo/status/34453323455 >}}

    {{< video https://youtube.com/foo/status/34453323455 >}}

*/

// TODO: crossref

// TODO: Port tinytex to JS; OR we need to implmeent various auto-install behaviors for latexmk, eg.
//    had to do this to get biblatex working w/ latexmk
//    (may want to automate installation if no biber + auto-map TinyTeX to path)
//       tlmgr install biblatex
//       tlmgr install biber
//       ln -sf /Users/jjallaire/Library/TinyTeX/bin/x86_64-darwin/biber /usr/local/bin/biber
//

// command line options for render
export interface RenderOptions {
  input: string;
  flags?: RenderFlags;
  pandocArgs?: string[];
}

export async function render(options: RenderOptions): Promise<ProcessResult> {
  // alias flags
  const flags = options.flags || {};
  const quiet = flags.quiet;

  // derive format options (looks in file and at project level _quarto.yml)
  const format = await formatForInputFile(
    options.input,
    flags.to,
  );

  // derive the computate engine's output file
  const [inputDir, inputStem] = dirAndStem(options.input);
  const computationOutput = join(inputDir, inputStem + ".md");

  // resolve computation parameters
  const params = resolveParams(flags.params);

  // run computations
  const computations = await runComputations({
    input: options.input,
    output: computationOutput,
    format,
    cwd: flags.computeDir,
    params,
    quiet,
  });

  // get pandoc output recipe (target file, args, complete handler)
  const recipe = outputRecipe(options, computationOutput, format);

  // run pandoc conversion
  const pandocOptions = {
    input: computationOutput,
    format: mergeConfigs(
      format.pandoc || {},
      computations.pandoc,
      recipe.pandoc,
    ),
    args: recipe.args,
    flags: options.flags,
    quiet,
  };
  const result = await runPandoc(pandocOptions);

  // return if we had an error
  if (!result.success) {
    return result;
  }

  // run optional post-processor
  if (computations.postprocess) {
    await postprocess({
      input: options.input,
      format,
      output: recipe.output,
      data: computations.postprocess,
      quiet,
    });
  }

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as necessary
  cleanup(options.input, flags, format, computations, finalOutput);

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    consoleWriteLine("\nOutput created: " + finalOutput + "\n");
  }

  // return result
  return result;
}

// resolve parameters (if any)
function resolveParams(params?: string) {
  if (!params || params === "ask") {
    return params;
  } else {
    return readYAML(params) as { [key: string]: unknown };
  }
}
