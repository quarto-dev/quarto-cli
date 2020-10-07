import { Command } from "cliffy/command/mod.ts";

import { writeLine } from "../../core/console.ts";
import type { ProcessResult } from "../../core/process.ts";

import { optionsForInputFile } from "./options.ts";
import { runComptations } from "./computation.ts";
import { runPandoc } from "./pandoc.ts";
import { fixupPandocArgs, parseRenderFlags } from "./flags.ts";

// TODO: generally, error handling for malformed input (e.g. yaml)
export interface RenderOptions {
  input: string;
  to?: string;
  output?: string;
  pandocArgs?: string[];
  quiet?: boolean;
}

// TODO: make sure we don't overrwite existing .md
// TODO: may want to ensure foo.quarto-rmd.md, foo.quarto-ipynb.md, etc.

export async function render(options: RenderOptions): Promise<ProcessResult> {
  const formatOptions = await optionsForInputFile(options.input, options.to);

  const computations = await runComptations({
    input: options.input,
    format: formatOptions,
    quiet: options.quiet,
  });

  return runPandoc({
    input: computations.output,
    output: options.output,
    format: formatOptions.pandoc!,
    args: options.pandocArgs || [],
    quiet: options.quiet,
  });
}

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input:string> [...pandoc-args:string]")
  .description(
    "Render a file using the supplied target format and pandoc command line arguments.\n" +
      "See pandoc --help for documentation on all available options.",
  )
  .option("-t, --to [to:string]", "Specify output format (defaults to html).")
  .option(
    "-o, --output [output:string]",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option("--quiet [quiet:boolean]", "Suppress warning and other messages.")
  .option(
    "[...pandoc-args:string]",
    "Additional pandoc command line arguments.",
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
      const result = await render({
        input,
        to: flags.to,
        output: flags.output,
        pandocArgs,
        quiet: flags.quiet,
      });

      if (!result.success) {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      if (error) {
        writeLine(error.toString());
      }
      Deno.exit(1);
    }
  });
