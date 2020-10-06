import { Command } from "cliffy/command/mod.ts";

import { basename, dirname, extname, join } from "path/mod.ts";
import type { FormatOptions } from "../api/format.ts";
import { mergeConfigs, projectConfig, QuartoConfig } from "../core/config.ts";
import { writeLine } from "../core/console.ts";

import { execProcess, ProcessResult } from "../core/process.ts";
import { formatOptionsFromConfig } from "../formats/formats.ts";

// TODO: support standard streams
//  - knitr output needs to go to stder
//  - we do 'auto-write' an output file, including forcing pdf
//  - we add a 'synthetic' pdf format, that writes latex -> pdf
//  - pdf and beamer always write pdf, keep_tex or --output test.tex is how you get the latex
//  - we need to pass --output through to pandoc
// default --standalone on for html (then allow user to do standalone: false)

// TODO: formats as pandoc passthrough
//  - handle input file positionally as we do now
//  - handle negating options (e.g. self-contained: false should remove the flag)
//  - handle --to for intercepting quarto formats
//  - forward all the rest to pandoc
//  - strategy for command line merging?
//  - infuse the non-pandoc options e.g. knitr, clean-supporting, etc.
//  - think about how to get preprocessor options through (user and format)

// TODO: cleanup all the todos in render and the rmd preprocessor

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input:string> [...pandoc-args:string]")
  .description(
    "Render a file using the supplied target format and pandoc command line arguments.",
  )
  .option(
    "-t, --to [to:string]",
    "Specify output format to convert to (e.g. html, pdf)",
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
    console.log(pandocArgs);
    try {
      const result = await render({ input, to: options.to, pandocArgs });
      if (!result.success) {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      if (error) {
        writeLine(Deno.stderr, error.toString());
      }
      Deno.exit(1);
    }
  });

export interface RenderOptions {
  input: string;
  to?: string;
  pandocArgs: string[];
}

// self_contained isn't working (we aren't getting base64 encoded images or intermedates)

export async function render(options: RenderOptions): Promise<ProcessResult> {
  // look for a 'project' _quarto.yml
  const projConfig: QuartoConfig = await projectConfig(options.input);

  // determine path to mdInput file and preprocessor
  let preprocessorOutput: string;

  // execute computational preprocessor (if any)
  const ext = extname(options.input);

  // TODO: still need to read the YAML out of plain markdown

  // provide default for 'to'
  options.to = options.to || "html";

  let format: FormatOptions | undefined;

  const preprocessor = computationPreprocessorForFile(ext);
  if (preprocessor) {
    // extract metadata
    const fileMetadata = await preprocessor.metadata(options.input);

    // derive quarto config from merge of project config into file config
    const config = mergeConfigs(projConfig, fileMetadata.quarto || {});

    // get the format
    format = formatOptionsFromConfig(options.to || "html", config);

    // TODO: make sure we don't overrwite existing .md
    // TODO: may want to ensure foo.quarto-rmd.md, foo.quarto-ipynb.md, etc.

    const inputDir = dirname(options.input);
    const inputBase = basename(options.input, ext);
    preprocessorOutput = join(inputDir, inputBase + ".md");
    const result = await preprocessor.preprocess(
      options.input,
      format,
      preprocessorOutput,
    );

    // TODO: clean intermediates referenced in result
  } else {
    preprocessorOutput = options.input;
  }

  // build the pandoc command
  const cmd = ["pandoc", basename(preprocessorOutput)];

  // TODO: currently can't use stdout due to knitr using it
  // TODO: need to actually respect if a pandoc --output or --O is passed
  const output = basename(options.input, ext) + "." +
    (format?.pandoc?.ext || "html");

  cmd.push("--output", output);

  cmd.push("--to", options.to);

  if (format?.pandoc?.args) {
    cmd.push(...format?.pandoc?.args);
  }
  cmd.push(...options.pandocArgs);

  // TODO: use the format for clean_supporting, keep_md, etc.

  // print command line
  // TODO: escape arguments
  writeLine(Deno.stdout, cmd.join(" ") + "\n");

  // run pandoc
  const result = await execProcess({
    cmd,
    cwd: dirname(preprocessorOutput),
  });

  // TODO: correct relative path so the IDE will always be able to preview it
  writeLine(Deno.stderr, "Output created: " + output + "\n");

  return result;
}
