import { Command } from "cliffy/command/mod.ts";
import { parseFlags } from "cliffy/flags/mod.ts";

import { basename, dirname, extname, join } from "path/mod.ts";

import { computationEngineForFile } from "../../computation/engine.ts";

import { writeLine } from "../../core/console.ts";
import type { ProcessResult } from "../../core/process.ts";
import { runComptations } from "./computation.ts";

import { optionsForInputFile } from "./options.ts";
import { runPandoc } from "./pandoc.ts";

// TODO: correct handling of --output command line

// TODO: generally, error handling for malformed input (e.g. yaml)

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input:string> [...pandoc-args:string]")
  .description(
    "Render a file using the supplied target format and pandoc command line arguments.",
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
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string, pandocArgs: string[]) => {
    try {
      const flags = parseFlags(pandocArgs);
      const to = flags.flags.t || flags.flags.to;
      const result = await render({ input, to, pandocArgs });
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

export interface RenderArgs {
  input: string;
  to?: string;
  pandocArgs: string[];
}

// TODO: override the writer based on computed (incorporates command line)

// TODO: make sure we don't overrwite existing .md
// TODO: may want to ensure foo.quarto-rmd.md, foo.quarto-ipynb.md, etc.

export async function render(renderArgs: RenderArgs): Promise<ProcessResult> {
  const options = await optionsForInputFile(renderArgs.input, renderArgs.to);
  const computations = await runComptations(renderArgs.input, options);
  return runPandoc(computations.output, options.pandoc!, renderArgs.pandocArgs);
}
