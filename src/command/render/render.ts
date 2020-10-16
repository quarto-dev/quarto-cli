import { basename, dirname, extname, join } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";

import { mergeConfigs } from "../../config/config.ts";

import { consoleWriteLine } from "../../core/console.ts";
import { ProcessResult } from "../../core/process.ts";
import { readYAML } from "../../core/yaml.ts";

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

// TODO: new config system
// TODO: fill out all the pandoc formats

// TODO: discover index.Rmd or ui.Rmd for quarto run

// PDF output will always make a tex file first
// We will always render to a "tex-safe" temp file

// we will delete the tex file if !keep_tex or !keep-all

// we will produce the pdf from the tex if requested.
// naive implementation of this is pdflatex (or other engine)

// https://github.com/rstudio/rmarkdown/blob/08c7567d6a2906d8f4471e0b295591d8e548d62e/R/render.R
// TODO: keep_tex
// TOOD: shell cars for tex
// TODO: Run citeproc (conditionally) / crossref
// TODO: LaTeX w/ TinyTex

// R-only features:
//

export interface RenderOptions {
  input: string;
  flags?: RenderFlags;
  pandocArgs?: string[];
}

export async function render(options: RenderOptions): Promise<ProcessResult> {
  // alias quiet
  const flags = options.flags || {};
  const quiet = flags.quiet;

  // derive format options (looks in file and at project level _quarto.yml)
  const format = await formatForInputFile(
    options.input,
    flags.to,
  );

  // derive the computate engine's output file
  const inputDir = dirname(options.input);
  const inputStem = basename(options.input, extname(options.input));
  const computationOutput = join(inputDir, inputStem + ".quarto.md");

  // resolve parameters
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
  const recipe = outputRecipe(options, inputDir, inputStem, format);

  // run pandoc conversion
  const result = await runPandoc({
    input: computationOutput,
    format: mergeConfigs(format.pandoc || {}, computations.pandoc),
    args: recipe.args,
    quiet,
  });

  // return if we had an error
  if (!result.success) {
    return result;
  }

  // run post processor
  if (computations.postprocess) {
    await postprocess({
      input: options.input,
      format,
      output: recipe.output,
      data: computations.postprocess,
      quiet,
    });
  }

  // call complete handler
  const outputCreated = await recipe.complete() || recipe.output;

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
