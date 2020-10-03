import { Command } from "cliffy/command/mod.ts";

import { basename, dirname, extname, join } from "path/mod.ts";
import type { Format } from "../api/format.ts";
import { mergeConfigs, projectConfig, QuartoConfig } from "../core/config.ts";
import { writeLine } from "../core/console.ts";

import { execProcess, ProcessResult } from "../core/process.ts";
import { formatFromConfig } from "../formats/formats.ts";

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

// --to pandoc:html

export const renderCommand = new Command()
  .name("render <input:string>")
  .description("Render a file")
  .option(
    "-t, --to [to:string]",
    "Specify output format to convert to (e.g. pandoc:html5)",
  )
  .option(
    "-o, --output [output:string]",
    "Write to output file instead of stdout",
  )
  .option(
    "--data-dir [data-dir:string]",
    "Specify the user data directory to search for pandoc data files.",
  )
  .example(
    "Render R Markdown",
    `quarto render notebook.Rmd`,
  )
  .example(
    "Render Jupyter Notebook",
    `quarto render notebook.ipynb`,
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    try {
      const result = await render({ input, ...options });
      if (result.success) {
        if (options.output) {
          writeLine(Deno.stderr, "Output created: " + options.output + "\n");
        }
      } else {
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
  output?: string;
  "data-dir"?: string;
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

  let format: Format | undefined;

  const preprocessor = computationPreprocessorForFile(ext);
  if (preprocessor) {
    // extract metadata
    const fileMetadata = await preprocessor.metadata(options.input);

    // derive quarto config from merge of project config into file config
    const config = mergeConfigs(projConfig, fileMetadata.quarto || {});

    // get the format
    format = formatFromConfig(config, options.to);

    // TODO: make sure we don't overrwite existing .md
    // TODO: may want to ensure foo.quarto-rmd.md, foo.quarto-ipynb.md, etc.

    const inputDir = dirname(options.input);
    const inputBase = basename(options.input, ext);
    preprocessorOutput = join(inputDir, inputBase + ".md");
    await preprocessor.preprocess(options.input, format, preprocessorOutput);
  } else {
    preprocessorOutput = options.input;
  }

  // build the pandoc command
  const cmd = ["pandoc", basename(preprocessorOutput)];

  if (options.output) {
    cmd.push("--output", options.output);

    // TODO: overwrite protection
  } else if (format?.pandoc?.ext) {
    cmd.push(
      "--output",
      join(
        dirname(options.input),
        basename(options.input, ext) + "." + format.pandoc.ext,
      ),
    );
  }
  if (format?.pandoc?.to) {
    cmd.push("--to", format?.pandoc?.to);
  }
  if (format?.pandoc?.args) {
    cmd.push(...format?.pandoc?.args);
  }
  if (options["data-dir"]) {
    cmd.push("--data-dir", options["data-dir"]);
  }

  // TODO: use the format for clean_supporting, keep_md, etc.

  // print command line
  writeLine(Deno.stdout, "\n" + cmd.join(" ") + "\n");

  // run pandoc
  const result = await execProcess({
    cmd,
    cwd: dirname(preprocessorOutput),
    stdout: "piped",
  });

  return result;
}
