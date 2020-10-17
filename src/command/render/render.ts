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

import { Command } from "cliffy/command/mod.ts";

import { mergeConfigs } from "../../config/config.ts";

import { consoleWriteLine } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
import { readYAML } from "../../core/yaml.ts";
import { dirAndStem } from "../../core/path.ts";

import { formatForInputFile } from "../../config/format.ts";

import { postProcess as postprocess, runComputations } from "./computation.ts";
import { runPandoc } from "./pandoc.ts";
import {
  fixupPandocArgs,
  kStdOut,
  parseRenderFlags,
  RenderFlags,
} from "./flags.ts";
import { cleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { pandocIncludesOptions } from "../../core/pandoc.ts";

// TODO: new config system
// TODO: fill out all the pandoc formats

// TODO: discover index.Rmd or ui.Rmd for quarto run

// https://github.com/rstudio/rmarkdown/blob/08c7567d6a2906d8f4471e0b295591d8e548d62e/R/render.R
// TODO: crossref
// TODO: LaTeX w/ TinyTex

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
  const computationOutput = join(inputDir, inputStem + ".quarto.md");

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
  const recipe = outputRecipe(computationOutput, options, format);

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

  // call complete handler (might e.g. run tinytex tc complete the render)
  const outputCreated = await recipe.complete(pandocOptions) || recipe.output;

  // cleanup as necessary
  cleanup(flags, format, computations, outputCreated);

  // report output created
  if (!flags.quiet && flags.output !== kStdOut) {
    consoleWriteLine("\nOutput created: " + outputCreated + "\n");
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

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input:string> [...pandoc-args:string]")
  .description(
    "Render a Quarto document.",
  )
  .option(
    "-t, --to [to:string]",
    "Specify output format (defaults to html).",
  )
  .option(
    "-o, --output [output:string]",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--self-contained [self-contained:boolean]",
    "Produce a standalone HTML file with no external dependencies, using data: URIs to incorporate the contents of linked scripts, stylesheets, images, and videos",
  )
  .option(
    "--keep-all [keep-all:boolean]",
    "Keep all intermediate files (e.g. markdown, tex, plots, etc.) even when producing a --self-contained document.",
  )
  .option(
    "--compute-dir [compute-dir:string]",
    "Working directory for computational preprocessing (e.g. knitr, nbconvert)",
  )
  .option(
    "--params [params:string]",
    "YAML file with parameter values (or 'ask' to prompt)",
  )
  .option(
    "--quiet [quiet:boolean]",
    "Suppress warning and other messages.",
  )
  .option(
    "pandoc-args... [...pandoc-args:string]",
    "Additional pandoc command line arguments. " +
      "See pandoc --help for documentation on all available options.",
  )
  .example(
    "Render R Markdown",
    "quarto render notebook.Rmd\n" +
      "quarto render notebook.Rmd --to html\n" +
      "quarto render notebook.Rmd --to pdf --toc",
  )
  .example(
    "Render Jupyter Notebook",
    "quarto render notebook.ipynb\n" +
      "quarto render notebook.ipynb --to docx\n" +
      "quarto render notebook.ipynb --to docx --highlight-style=espresso\n",
  )
  .example(
    "Render to Standard Output",
    "quarto render notebook.Rmd --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string, pandocArgs: string[]) => {
    try {
      // extract pandoc flags we know/care about (they will still go to pandoc)
      const flags = parseRenderFlags(pandocArgs);

      // fixup args as necessary
      pandocArgs = fixupPandocArgs(pandocArgs, flags);

      // run render
      const result = await render({ input, flags, pandocArgs });

      if (!result.success) {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      if (error) {
        consoleWriteLine(error.toString());
      }
      Deno.exit(1);
    }
  });
